"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "@/components/ui/star-rating";
import { cn } from "@/lib/utils/cn";

interface NewsletterCardProps {
  newsletter: {
    id: string;
    subject: string;
    summary: string | null;
    publishedAt: string | null;
    source: {
      name: string;
      logoUrl: string | null;
    };
    tags: { name: string; slug: string }[];
    _count: {
      comments: number;
      ratings: number;
    };
    averageRating: number;
  };
}

export function NewsletterCard({ newsletter }: NewsletterCardProps) {
  const {
    id,
    subject,
    summary,
    publishedAt,
    source,
    tags,
    _count,
    averageRating,
  } = newsletter;

  return (
    <Card className="flex flex-col gap-3">
      {/* Source + Date */}
      <div className="flex items-center gap-2.5">
        {source.logoUrl ? (
          <img
            src={source.logoUrl}
            alt={source.name}
            className="h-6 w-6 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-primary)] text-[10px] font-bold text-white">
            {source.name.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="text-sm font-medium text-[var(--color-text)]">
          {source.name}
        </span>
        {publishedAt && (
          <>
            <span className="text-[var(--color-text-secondary)]">·</span>
            <time
              dateTime={publishedAt}
              className="text-xs text-[var(--color-text-secondary)]"
            >
              {formatDistanceToNow(new Date(publishedAt), { addSuffix: true })}
            </time>
          </>
        )}
      </div>

      {/* Title */}
      <Link
        href={`/newsletters/${id}`}
        className="text-lg font-semibold text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors leading-snug"
      >
        {subject}
      </Link>

      {/* Summary */}
      {summary && (
        <p className="text-sm text-[var(--color-text-secondary)] line-clamp-3 leading-relaxed">
          {summary}
        </p>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <Link key={tag.slug} href={`/explore?tag=${tag.slug}`}>
              <Badge variant="default">{tag.name}</Badge>
            </Link>
          ))}
        </div>
      )}

      {/* Bottom row */}
      <div className="flex items-center justify-between pt-1 border-t border-[var(--color-border)]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <StarRating rating={averageRating} readonly size="sm" />
            <span className="text-xs text-[var(--color-text-secondary)]">
              ({_count.ratings})
            </span>
          </div>

          <div className="flex items-center gap-1 text-[var(--color-text-secondary)]">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zm-4 0H9v2h2V9z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-xs">{_count.comments}</span>
          </div>
        </div>

        <Link
          href={`/newsletters/${id}`}
          className="text-sm font-medium text-[var(--color-primary)] hover:underline"
        >
          Read more →
        </Link>
      </div>
    </Card>
  );
}
