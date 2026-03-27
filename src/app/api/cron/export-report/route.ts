import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

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

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const [
    totalImported,
    totalProcessed,
    totalFailed,
    sourceBreakdown,
    newSources,
    importLogs,
  ] = await Promise.all([
    prisma.newsletter.count({
      where: { importedAt: { gte: oneWeekAgo } },
    }),
    prisma.newsletter.count({
      where: {
        importedAt: { gte: oneWeekAgo },
        isProcessed: true,
      },
    }),
    prisma.emailImportLog.count({
      where: {
        receivedAt: { gte: oneWeekAgo },
        status: "FAILED",
      },
    }),
    prisma.newsletter.groupBy({
      by: ["sourceId"],
      where: { importedAt: { gte: oneWeekAgo } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),
    prisma.newsletterSource.findMany({
      where: { createdAt: { gte: oneWeekAgo } },
      select: {
        id: true,
        name: true,
        senderEmail: true,
        isApproved: true,
        createdAt: true,
      },
    }),
    prisma.emailImportLog.groupBy({
      by: ["status"],
      where: { receivedAt: { gte: oneWeekAgo } },
      _count: { id: true },
    }),
  ]);

  // Resolve source names for the breakdown
  const sourceIds = sourceBreakdown.map((s) => s.sourceId);
  const sources = await prisma.newsletterSource.findMany({
    where: { id: { in: sourceIds } },
    select: { id: true, name: true, senderEmail: true },
  });
  const sourceMap = new Map(sources.map((s) => [s.id, s]));

  const breakdownBySource = sourceBreakdown.map((entry) => {
    const source = sourceMap.get(entry.sourceId);
    return {
      sourceId: entry.sourceId,
      sourceName: source?.name ?? "Unknown",
      senderEmail: source?.senderEmail ?? "Unknown",
      count: entry._count.id,
    };
  });

  const importStatusBreakdown = Object.fromEntries(
    importLogs.map((entry) => [entry.status, entry._count.id])
  );

  const report = {
    period: {
      from: oneWeekAgo.toISOString(),
      to: new Date().toISOString(),
    },
    summary: {
      totalImported,
      totalProcessed,
      totalFailed,
      totalPending: totalImported - totalProcessed,
    },
    importStatusBreakdown,
    breakdownBySource,
    newSources: newSources.map((s) => ({
      id: s.id,
      name: s.name,
      senderEmail: s.senderEmail,
      isApproved: s.isApproved,
      discoveredAt: s.createdAt.toISOString(),
    })),
    generatedAt: new Date().toISOString(),
    // TODO: Send this report via Resend to admin email
  };

  return NextResponse.json(report);
}
