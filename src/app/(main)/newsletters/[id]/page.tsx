import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { NewsletterContent } from "@/components/newsletter/newsletter-content";
import { RatingWidget } from "@/components/newsletter/rating-widget";
import { CommentSection } from "@/components/newsletter/comment-section";
import { PaywallOverlay } from "@/components/newsletter/paywall";
import { NewsletterCard } from "@/components/newsletter/newsletter-card";

const FREE_LIMIT = parseInt(process.env.FREE_NEWSLETTERS_PER_WEEK ?? "3", 10);

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function NewsletterPage({ params }: PageProps) {
  const { id } = await params;

  const newsletter = await prisma.newsletter.findUnique({
    where: { id },
    include: {
      source: true,
      tags: { include: { tag: { select: { name: true, slug: true } } } },
      ratings: { select: { score: true, userId: true } },
      _count: { select: { comments: true, ratings: true } },
    },
  });

  if (!newsletter) return notFound();

  // Calculate average rating
  const avgRating =
    newsletter.ratings.length > 0
      ? newsletter.ratings.reduce((s, r) => s + r.score, 0) /
        newsletter.ratings.length
      : 0;

  // Auth + paywall check
  const session = await auth();
  let showPaywall = false;
  let userRating: number | undefined;

  if (session?.user) {
    userRating = newsletter.ratings.find(
      (r) => r.userId === session.user.id
    )?.score;

    if (session.user.role === "FREE") {
      const weekStart = getStartOfWeek();
      const readCount = await prisma.readHistory.count({
        where: {
          userId: session.user.id,
          readAt: { gte: weekStart },
        },
      });

      if (readCount >= FREE_LIMIT) {
        showPaywall = true;
      } else {
        // Record this read
        await prisma.readHistory.upsert({
          where: {
            userId_newsletterId: {
              userId: session.user.id,
              newsletterId: id,
            },
          },
          create: { userId: session.user.id, newsletterId: id },
          update: {},
        });
      }
    }
  }

  // Related newsletters from same source
  const related = await prisma.newsletter.findMany({
    where: {
      sourceId: newsletter.sourceId,
      id: { not: newsletter.id },
      isProcessed: true,
    },
    orderBy: { publishedAt: "desc" },
    take: 5,
    include: {
      source: { select: { name: true, logoUrl: true } },
      tags: { include: { tag: { select: { name: true, slug: true } } } },
      _count: { select: { comments: true, ratings: true } },
      ratings: { select: { score: true } },
    },
  });

  const relatedMapped = related.map((n) => {
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

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Main content */}
      <article className="flex-1 min-w-0 space-y-8">
        {/* Header */}
        <header className="space-y-4">
          <Link
            href={`/sources/${newsletter.source.id}`}
            className="inline-flex items-center gap-2.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors"
          >
            {newsletter.source.logoUrl ? (
              <img
                src={newsletter.source.logoUrl}
                alt={newsletter.source.name}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-bold text-white">
                {newsletter.source.name.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="font-medium">{newsletter.source.name}</span>
          </Link>

          <h1 className="text-3xl font-bold text-[var(--color-text)] leading-tight">
            {newsletter.subject}
          </h1>

          <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--color-text-secondary)]">
            {newsletter.publishedAt && (
              <time dateTime={newsletter.publishedAt.toISOString()}>
                {format(newsletter.publishedAt, "MMMM d, yyyy")}
              </time>
            )}
            {newsletter.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {newsletter.tags.map((nt) => (
                  <Link key={nt.tag.slug} href={`/explore?tag=${nt.tag.slug}`}>
                    <Badge>{nt.tag.name}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </header>

        {/* Content with potential paywall */}
        <div className="relative">
          <div className={showPaywall ? "max-h-96 overflow-hidden" : undefined}>
            <NewsletterContent
              processedContent={newsletter.processedContent}
              rawHtml={newsletter.rawHtml}
            />
          </div>
          {showPaywall && <PaywallOverlay />}
        </div>

        {/* Rating + Comments (only if no paywall) */}
        {!showPaywall && (
          <>
            <div className="border-t border-[var(--color-border)] pt-6">
              <RatingWidget
                newsletterId={newsletter.id}
                initialRating={Math.round(avgRating * 10) / 10}
                initialCount={newsletter._count.ratings}
                userRating={userRating}
              />
            </div>

            <div className="border-t border-[var(--color-border)] pt-6">
              <CommentSection newsletterId={newsletter.id} />
            </div>
          </>
        )}
      </article>

      {/* Sidebar */}
      <aside className="lg:w-72 shrink-0 space-y-6">
        {/* Source info card */}
        <Card>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {newsletter.source.logoUrl ? (
                <img
                  src={newsletter.source.logoUrl}
                  alt={newsletter.source.name}
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-bold text-white">
                  {newsletter.source.name.charAt(0).toUpperCase()}
                </span>
              )}
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text)]">
                  {newsletter.source.name}
                </h3>
                {newsletter.source.category && (
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {newsletter.source.category}
                  </span>
                )}
              </div>
            </div>
            {newsletter.source.description && (
              <p className="text-sm text-[var(--color-text-secondary)] line-clamp-3">
                {newsletter.source.description}
              </p>
            )}
            <Link
              href={`/sources/${newsletter.source.id}`}
              className="block text-sm font-medium text-[var(--color-primary)] hover:underline"
            >
              View all newsletters →
            </Link>
          </div>
        </Card>

        {/* Related newsletters */}
        {relatedMapped.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-[var(--color-text)]">
              More from {newsletter.source.name}
            </h3>
            <div className="space-y-3">
              {relatedMapped.map((r) => (
                <Card key={r.id} href={`/newsletters/${r.id}`} className="p-3">
                  <h4 className="text-sm font-medium text-[var(--color-text)] line-clamp-2 leading-snug">
                    {r.subject}
                  </h4>
                  {r.publishedAt && (
                    <time className="mt-1 block text-xs text-[var(--color-text-secondary)]">
                      {format(new Date(r.publishedAt), "MMM d, yyyy")}
                    </time>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function getStartOfWeek(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1; // Monday = start of week
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}
