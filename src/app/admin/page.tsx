import { Card } from "@/components/ui/card";
import prisma from "@/lib/db";
import { ImportStatus } from "@/generated/prisma/enums";

export default async function AdminDashboardPage() {
  const [
    totalNewsletters,
    processedImports,
    pendingImports,
    failedImports,
    recentNewsletters,
    topSources,
    userCount,
  ] = await Promise.all([
    prisma.newsletter.count(),
    prisma.emailImportLog.count({ where: { status: ImportStatus.PROCESSED } }),
    prisma.emailImportLog.count({ where: { status: ImportStatus.PENDING } }),
    prisma.emailImportLog.count({ where: { status: ImportStatus.FAILED } }),
    prisma.newsletter.findMany({
      include: { source: { select: { name: true } } },
      orderBy: { importedAt: "desc" },
      take: 10,
    }),
    prisma.newsletterSource.findMany({
      select: {
        id: true,
        name: true,
        _count: { select: { newsletters: true } },
      },
      orderBy: { newsletters: { _count: "desc" } },
      take: 5,
    }),
    prisma.user.count(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Admin Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-sm text-[var(--color-text-secondary)]">Total newsletters</p>
          <p className="mt-2 text-2xl font-bold">{totalNewsletters}</p>
        </Card>
        <Card>
          <p className="text-sm text-[var(--color-text-secondary)]">Processed imports</p>
          <p className="mt-2 text-2xl font-bold">{processedImports}</p>
        </Card>
        <Card>
          <p className="text-sm text-[var(--color-text-secondary)]">Pending imports</p>
          <p className="mt-2 text-2xl font-bold">{pendingImports}</p>
        </Card>
        <Card>
          <p className="text-sm text-[var(--color-text-secondary)]">Failed imports</p>
          <p className="mt-2 text-2xl font-bold">{failedImports}</p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold">Recent activity</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {recentNewsletters.map((newsletter) => (
              <li key={newsletter.id} className="rounded-lg border border-[var(--color-border)] p-3">
                <p className="font-medium">{newsletter.subject}</p>
                <p className="text-[var(--color-text-secondary)]">
                  {newsletter.source.name} · {newsletter.importedAt.toLocaleString()}
                </p>
              </li>
            ))}
            {recentNewsletters.length === 0 && (
              <li className="text-[var(--color-text-secondary)]">No recent imports found.</li>
            )}
          </ul>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold">Quick stats</h2>
          <p className="mt-3 text-sm text-[var(--color-text-secondary)]">User count: {userCount}</p>

          <h3 className="mt-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
            Most active sources
          </h3>
          <ul className="mt-2 space-y-2 text-sm">
            {topSources.map((source, index) => (
              <li key={source.id} className="flex items-center justify-between rounded-md border border-[var(--color-border)] px-3 py-2">
                <span>
                  {index + 1}. {source.name}
                </span>
                <span className="text-[var(--color-text-secondary)]">{source._count.newsletters} newsletters</span>
              </li>
            ))}
            {topSources.length === 0 && (
              <li className="text-[var(--color-text-secondary)]">No source data available.</li>
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}
