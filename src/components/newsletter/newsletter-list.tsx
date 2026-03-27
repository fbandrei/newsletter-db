"use client";

import { useState, useCallback } from "react";
import { NewsletterCard } from "./newsletter-card";
import { LoadingCard } from "@/components/ui/loading";
import { Button } from "@/components/ui/button";

type Newsletter = {
  id: string;
  subject: string;
  summary: string | null;
  publishedAt: string | null;
  source: { name: string; logoUrl: string | null };
  tags: { name: string; slug: string }[];
  _count: { comments: number; ratings: number };
  averageRating: number;
};

interface Filters {
  tags?: string[];
  sourceId?: string;
  search?: string;
  sort?: "newest" | "top-rated" | "most-discussed";
}

interface NewsletterListProps {
  initialNewsletters: Newsletter[];
  filters?: Filters;
}

const PAGE_SIZE = 20;

export function NewsletterList({
  initialNewsletters,
  filters,
}: NewsletterListProps) {
  const [newsletters, setNewsletters] =
    useState<Newsletter[]>(initialNewsletters);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(
    initialNewsletters.length >= PAGE_SIZE
  );

  const loadMore = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page + 1));
      params.set("limit", String(PAGE_SIZE));
      if (filters?.tags?.length) params.set("tags", filters.tags.join(","));
      if (filters?.sourceId) params.set("sourceId", filters.sourceId);
      if (filters?.search) params.set("search", filters.search);
      if (filters?.sort) params.set("sort", filters.sort);

      const res = await fetch(`/api/newsletters?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch newsletters");

      const data: Newsletter[] = await res.json();
      setNewsletters((prev) => [...prev, ...data]);
      setPage((p) => p + 1);
      setHasMore(data.length >= PAGE_SIZE);
    } catch (err) {
      console.error("Error loading newsletters:", err);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  if (newsletters.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <svg
          className="h-12 w-12 text-[var(--color-text-secondary)] mb-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21.75 9v.906a2.25 2.25 0 01-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 001.183 1.981l6.478 3.488m8.839 2.51l-4.66-2.51m0 0l-1.023-.55a2.25 2.25 0 00-2.134 0l-1.022.55m0 0l-4.661 2.51m16.5-1.875a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
          />
        </svg>
        <h3 className="text-lg font-semibold text-[var(--color-text)]">
          No newsletters found
        </h3>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Try adjusting your filters or check back later for new content.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {newsletters.map((newsletter) => (
        <NewsletterCard key={newsletter.id} newsletter={newsletter} />
      ))}

      {loading && (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <LoadingCard key={i} />
          ))}
        </div>
      )}

      {hasMore && !loading && (
        <div className="flex justify-center pt-2">
          <Button variant="secondary" onClick={loadMore}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
