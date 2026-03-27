import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";

const VALID_PREFS = new Set(["INSTANT", "DAILY_DIGEST", "OFF"] as const);

type NotificationPref = "INSTANT" | "DAILY_DIGEST" | "OFF";

export async function GET(req: NextRequest) {
  try {
    void req;
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const favorites = await prisma.userFavorite.findMany({
      where: { userId: session.user.id },
      include: {
        source: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            senderEmail: true,
            websiteUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ favorites });
  } catch (error) {
    console.error("Failed to fetch favorites", error);
    return NextResponse.json({ error: "Failed to fetch favorites" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await req.json();
    const sourceId = String(payload?.sourceId || "").trim();
    const notificationPref = payload?.notificationPref
      ? String(payload.notificationPref).trim()
      : "INSTANT";

    if (!sourceId) {
      return NextResponse.json({ error: "sourceId is required" }, { status: 400 });
    }

    if (!VALID_PREFS.has(notificationPref as NotificationPref)) {
      return NextResponse.json({ error: "Invalid notificationPref" }, { status: 400 });
    }

    const source = await prisma.newsletterSource.findUnique({
      where: { id: sourceId },
      select: { id: true },
    });

    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    const existing = await prisma.userFavorite.findUnique({
      where: {
        userId_sourceId: {
          userId: session.user.id,
          sourceId,
        },
      },
    });

    if (existing) {
      await prisma.userFavorite.delete({
        where: {
          id: existing.id,
        },
      });

      return NextResponse.json({
        favorited: false,
        sourceId,
      });
    }

    const favorite = await prisma.userFavorite.create({
      data: {
        userId: session.user.id,
        sourceId,
        notificationPref: notificationPref as NotificationPref,
      },
      include: {
        source: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            senderEmail: true,
            websiteUrl: true,
          },
        },
      },
    });

    return NextResponse.json({
      favorited: true,
      favorite,
    });
  } catch (error) {
    console.error("Failed to toggle favorite", error);
    return NextResponse.json({ error: "Failed to toggle favorite" }, { status: 500 });
  }
}
