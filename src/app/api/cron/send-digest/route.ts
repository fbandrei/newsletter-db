import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

function verifyCronSecret(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

interface DigestSourceGroup {
  sourceName: string;
  newsletters: { id: string; subject: string; summary: string | null; publishedAt: Date | null }[];
}

function buildDigestHtml(
  userName: string,
  groups: DigestSourceGroup[]
): string {
  const sourceBlocks = groups
    .map((group) => {
      const items = group.newsletters
        .map(
          (nl) =>
            `<li style="margin-bottom:8px;">
              <strong>${escapeHtml(nl.subject)}</strong>
              ${nl.summary ? `<br/><span style="color:#666;font-size:14px;">${escapeHtml(nl.summary.slice(0, 200))}${nl.summary.length > 200 ? "…" : ""}</span>` : ""}
            </li>`
        )
        .join("");

      return `
        <div style="margin-bottom:24px;">
          <h3 style="color:#333;border-bottom:1px solid #eee;padding-bottom:8px;">
            ${escapeHtml(group.sourceName)} (${group.newsletters.length} new)
          </h3>
          <ul style="list-style:none;padding:0;">${items}</ul>
        </div>`;
    })
    .join("");

  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <h2 style="color:#1a1a1a;">Your Daily Newsletter Digest</h2>
      <p>Hi ${escapeHtml(userName || "there")}, here's what's new from your favorite sources:</p>
      ${sourceBlocks}
      <hr style="border:none;border-top:1px solid #eee;margin-top:32px;" />
      <p style="color:#999;font-size:12px;">
        You're receiving this because you have daily digest notifications enabled.
      </p>
    </div>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  // Find users who have at least one favorite with DAILY_DIGEST preference
  const usersWithDigestPref = await prisma.userFavorite.findMany({
    where: { notificationPref: "DAILY_DIGEST" },
    select: {
      userId: true,
      sourceId: true,
      user: { select: { id: true, name: true, email: true } },
      source: { select: { id: true, name: true } },
    },
  });

  // Group favorites by user
  const userFavoritesMap = new Map<
    string,
    {
      user: { id: string; name: string | null; email: string };
      sources: Map<string, string>;
    }
  >();

  for (const fav of usersWithDigestPref) {
    if (!userFavoritesMap.has(fav.userId)) {
      userFavoritesMap.set(fav.userId, {
        user: fav.user,
        sources: new Map(),
      });
    }
    userFavoritesMap.get(fav.userId)!.sources.set(fav.sourceId, fav.source.name);
  }

  let usersNotified = 0;
  let newslettersIncluded = 0;
  const errors: string[] = [];

  for (const [userId, { user, sources }] of userFavoritesMap) {
    try {
      const sourceIds = Array.from(sources.keys());

      // Find new newsletters from favorited sources since last digest
      const newNewsletters = await prisma.newsletter.findMany({
        where: {
          sourceId: { in: sourceIds },
          importedAt: { gte: oneDayAgo },
        },
        select: {
          id: true,
          sourceId: true,
          subject: true,
          summary: true,
          publishedAt: true,
        },
        orderBy: { publishedAt: "desc" },
      });

      if (newNewsletters.length === 0) continue;

      // Group newsletters by source
      const groups: DigestSourceGroup[] = [];
      const bySource = new Map<string, typeof newNewsletters>();

      for (const nl of newNewsletters) {
        if (!bySource.has(nl.sourceId)) {
          bySource.set(nl.sourceId, []);
        }
        bySource.get(nl.sourceId)!.push(nl);
      }

      for (const [sourceId, newsletters] of bySource) {
        groups.push({
          sourceName: sources.get(sourceId) || "Unknown Source",
          newsletters,
        });
      }

      const digestHtml = buildDigestHtml(user.name || user.email, groups);

      // Create a notification record for the digest
      await prisma.notification.create({
        data: {
          userId,
          type: "NEW_NEWSLETTER",
          message: `Daily digest: ${newNewsletters.length} new newsletter${newNewsletters.length === 1 ? "" : "s"} from ${groups.length} source${groups.length === 1 ? "" : "s"}`,
        },
      });

      // TODO: Send digestHtml via Resend to user.email
      // await resend.emails.send({
      //   from: "digest@newsletter-db.com",
      //   to: user.email,
      //   subject: `Your Daily Digest — ${newNewsletters.length} new newsletters`,
      //   html: digestHtml,
      // });

      usersNotified++;
      newslettersIncluded += newNewsletters.length;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      errors.push(`User ${userId}: ${message}`);
    }
  }

  return NextResponse.json({
    usersNotified,
    newslettersIncluded,
    totalUsersEligible: userFavoritesMap.size,
    errors: errors.length > 0 ? errors : undefined,
  });
}
