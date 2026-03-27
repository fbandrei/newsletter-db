import Link from "next/link";
import prisma from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface PageProps {
  searchParams: Promise<{ tag?: string; q?: string }>;
}

export default async function ExplorePage({ searchParams }: PageProps) {
  const params = await searchParams;

  // Fetch tags with newsletter counts
  const tags = await prisma.tag.findMany({
    include: { _count: { select: { newsletters: true } } },
    orderBy: { newsletters: { _count: "desc" } },
  });

  // Fetch top sources
  const sources = await prisma.newsletterSource.findMany({
    where: { isApproved: true },
    include: { _count: { select: { newsletters: true, subscriptions: true } } },
    orderBy: { newsletters: { _count: "desc" } },
    take: 12,
  });

  return (
    <div className="space-y-10">
      {/* Header + Search */}
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">
          Explore
        </h1>
        <p className="text-[var(--color-text-secondary)]">
          Discover newsletters by topic or browse popular sources.
        </p>
        <form action="/explore" method="GET" className="max-w-md">
          <Input
            name="q"
            placeholder="Search newsletters, topics, sources…"
            defaultValue={params.q ?? ""}
          />
        </form>
      </div>

      {/* Tags grid */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">
          Topics
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {tags.map((tag) => (
            <Link key={tag.id} href={`/explore?tag=${tag.slug}`}>
              <Card
                className={
                  params.tag === tag.slug
                    ? "border-[var(--color-primary)] bg-blue-50 dark:bg-blue-900/20 p-4"
                    : "p-4"
                }
              >
                <h3 className="text-sm font-medium text-[var(--color-text)]">
                  {tag.name}
                </h3>
                <span className="text-xs text-[var(--color-text-secondary)]">
                  {tag._count.newsletters}{" "}
                  {tag._count.newsletters === 1 ? "newsletter" : "newsletters"}
                </span>
              </Card>
            </Link>
          ))}
        </div>

        {tags.length === 0 && (
          <p className="text-sm text-[var(--color-text-secondary)] text-center py-8">
            No topics yet. Topics are generated as newsletters are processed.
          </p>
        )}
      </section>

      {/* Popular sources */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">
          Popular Sources
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sources.map((source) => (
            <Link key={source.id} href={`/sources/${source.id}`}>
              <Card className="flex items-center gap-3">
                {source.logoUrl ? (
                  <img
                    src={source.logoUrl}
                    alt={source.name}
                    className="h-10 w-10 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-bold text-white shrink-0">
                    {source.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-[var(--color-text)] truncate">
                    {source.name}
                  </h3>
                  <div className="flex gap-3 text-xs text-[var(--color-text-secondary)]">
                    <span>{source._count.newsletters} issues</span>
                    <span>{source._count.subscriptions} subscribers</span>
                  </div>
                  {source.category && (
                    <Badge variant="default" className="mt-1">
                      {source.category}
                    </Badge>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>

        {sources.length === 0 && (
          <p className="text-sm text-[var(--color-text-secondary)] text-center py-8">
            No sources available yet.
          </p>
        )}
      </section>
    </div>
  );
}
