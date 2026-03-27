import { notFound } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NewsletterCard } from "@/components/newsletter/newsletter-card";
import { SourceActions } from "./source-actions";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}

const PAGE_SIZE = 20;

export default async function SourcePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const pageNum = Math.max(1, parseInt(sp.page ?? "1", 10));

  const source = await prisma.newsletterSource.findUnique({
    where: { id },
    include: {
      _count: { select: { newsletters: true, subscriptions: true, favorites: true } },
    },
  });

  if (!source) return notFound();

  const session = await auth();

  // Check subscription/favorite status
  let isSubscribed = false;
  let isFavorited = false;
  if (session?.user) {
    const [sub, fav] = await Promise.all([
      prisma.subscription.findUnique({
        where: { userId_sourceId: { userId: session.user.id, sourceId: id } },
      }),
      prisma.userFavorite.findUnique({
        where: { userId_sourceId: { userId: session.user.id, sourceId: id } },
      }),
    ]);
    isSubscribed = !!sub;
    isFavorited = !!fav;
  }

  const newsletters = await prisma.newsletter.findMany({
    where: { sourceId: id, isProcessed: true },
    orderBy: { publishedAt: "desc" },
    skip: (pageNum - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: {
      source: { select: { name: true, logoUrl: true } },
      tags: { include: { tag: { select: { name: true, slug: true } } } },
      _count: { select: { comments: true, ratings: true } },
      ratings: { select: { score: true } },
    },
  });

  const mapped = newsletters.map((n) => {
    const avg =
      n.ratings.length > 0
        ? n.ratings.reduce((s, r) => s + r.score, 0) / n.ratings.length
        : 0;
    return {
      id: n.id,
      subject: n.subject,
      summary: n.summary,
      publishedAt: n.publishedAt?.toISOString() ?? null,
      source: n.source,
      tags: n.tags.map((nt) => nt.tag),
      _count: n._count,
      averageRating: Math.round(avg * 10) / 10,
    };
  });

  const totalPages = Math.ceil(source._count.newsletters / PAGE_SIZE);

  return (
    <div className="space-y-8">
      {/* Source header */}
      <Card>
        <div className="flex flex-col sm:flex-row gap-4 sm:items-start">
          {source.logoUrl ? (
            <img
              src={source.logoUrl}
              alt={source.name}
              className="h-16 w-16 rounded-xl object-cover shrink-0"
            />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-[var(--color-primary)] text-xl font-bold text-white shrink-0">
              {source.name.charAt(0).toUpperCase()}
            </span>
          )}

          <div className="flex-1 min-w-0 space-y-2">
            <h1 className="text-2xl font-bold text-[var(--color-text)]">
              {source.name}
            </h1>

            {source.description && (
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                {source.description}
              </p>
            )}

            <div className="flex flex-wrap gap-4 text-sm text-[var(--color-text-secondary)]">
              <span>{source._count.newsletters} newsletters</span>
              <span>{source._count.subscriptions} subscribers</span>
              {source.websiteUrl && (
                <a
                  href={source.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-primary)] hover:underline"
                >
                  Website ↗
                </a>
              )}
            </div>
          </div>

          {session && (
            <SourceActions
              sourceId={id}
              initialSubscribed={isSubscribed}
              initialFavorited={isFavorited}
            />
          )}
        </div>
      </Card>

      {/* Newsletters list */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">
          All Newsletters
        </h2>

        {mapped.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)] py-8 text-center">
            No newsletters published yet.
          </p>
        ) : (
          <div className="space-y-4">
            {mapped.map((n) => (
              <NewsletterCard key={n.id} newsletter={n} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            {pageNum > 1 && (
              <Link href={`/sources/${id}?page=${pageNum - 1}`}>
                <Button variant="secondary" size="sm">
                  ← Previous
                </Button>
              </Link>
            )}
            <span className="text-sm text-[var(--color-text-secondary)] px-3">
              Page {pageNum} of {totalPages}
            </span>
            {pageNum < totalPages && (
              <Link href={`/sources/${id}?page=${pageNum + 1}`}>
                <Button variant="secondary" size="sm">
                  Next →
                </Button>
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
