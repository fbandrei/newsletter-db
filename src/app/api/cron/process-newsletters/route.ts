import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { processNewsletter } from "@/lib/ai/pipeline";

function verifyCronSecret(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const newsletters = await prisma.newsletter.findMany({
    where: { isProcessed: false },
    orderBy: { importedAt: "asc" },
    take: 10,
    select: { id: true, subject: true },
  });

  if (newsletters.length === 0) {
    return NextResponse.json({
      processed: 0,
      failed: 0,
      errors: [],
      message: "No unprocessed newsletters found",
    });
  }

  let processed = 0;
  const errors: string[] = [];

  for (const newsletter of newsletters) {
    try {
      await processNewsletter(newsletter.id);

      await prisma.emailImportLog.updateMany({
        where: { newsletterId: newsletter.id },
        data: { status: "PROCESSED" },
      });

      processed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      errors.push(`Newsletter ${newsletter.id} ("${newsletter.subject}"): ${message}`);

      await prisma.emailImportLog.updateMany({
        where: { newsletterId: newsletter.id },
        data: {
          status: "FAILED",
          errorMessage: message.slice(0, 500),
        },
      });
    }
  }

  return NextResponse.json({
    processed,
    failed: errors.length,
    total: newsletters.length,
    errors,
  });
}
