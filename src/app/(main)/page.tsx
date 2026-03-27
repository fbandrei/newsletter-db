import prisma from "@/lib/db";
import { NewsletterList } from "@/components/newsletter/newsletter-list";

type SortOption = "newest" | "top-rated" | "most-discussed";

interface PageProps {
  searchParams: Promise<{ sort?: string }>;
}

export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const sort = (params.sort as SortOption) || "newest";

  const newsletters = await prisma.newsletter.findMany({
    where: { isProcessed: true },
    orderBy:
      sort === "newest"
        ? { publishedAt: "desc" }
        : sort === "most-discussed"
          ? { comments: { _count: "desc" } }
          : { publishedAt: "desc" },
    take: 20,
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
        ? n.ratings.reduce((sum, r) => sum + r.score, 0) / n.ratings.length
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

  // For top-rated sort, sort on the server since Prisma can't order by aggregate
  if (sort === "top-rated") {
    mapped.sort((a, b) => b.averageRating - a.averageRating);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">
          Latest Newsletters
        </h1>
        <SortControls current={sort} />
      </div>
      <NewsletterList initialNewsletters={mapped} filters={{ sort }} />
    </div>
  );
}

function SortControls({ current }: { current: SortOption }) {
  const options: { value: SortOption; label: string }[] = [
    { value: "newest", label: "Newest" },
    { value: "top-rated", label: "Top Rated" },
    { value: "most-discussed", label: "Most Discussed" },
  ];

  return (
    <div className="flex gap-1 rounded-lg bg-[var(--color-bg-secondary)] p-1">
      {options.map((opt) => (
        <a
          key={opt.value}
          href={`?sort=${opt.value}`}
          className={
            current === opt.value
              ? "rounded-md bg-[var(--color-bg)] px-3 py-1.5 text-sm font-medium text-[var(--color-text)] shadow-sm"
              : "rounded-md px-3 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
          }
        >
          {opt.label}
        </a>
      ))}
    </div>
  );
}
