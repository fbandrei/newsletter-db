"use client";

import { useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { StarRating } from "@/components/ui/star-rating";

interface RatingWidgetProps {
  newsletterId: string;
  initialRating: number;
  initialCount: number;
  userRating?: number;
}

export function RatingWidget({
  newsletterId,
  initialRating,
  initialCount,
  userRating,
}: RatingWidgetProps) {
  const { data: session } = useSession();
  const [average, setAverage] = useState(initialRating);
  const [count, setCount] = useState(initialCount);
  const [myRating, setMyRating] = useState(userRating ?? 0);
  const [saving, setSaving] = useState(false);

  const handleRate = useCallback(
    async (score: number) => {
      if (!session) return;

      const prevAvg = average;
      const prevCount = count;
      const prevMy = myRating;

      // Optimistic update
      const isNew = myRating === 0;
      const newCount = isNew ? count + 1 : count;
      const newAvg = isNew
        ? (average * count + score) / newCount
        : (average * count - myRating + score) / count;

      setMyRating(score);
      setAverage(newAvg);
      setCount(newCount);

      setSaving(true);
      try {
        const res = await fetch(`/api/newsletters/${newsletterId}/ratings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ score }),
        });

        if (!res.ok) throw new Error("Failed to save rating");

        const data = await res.json();
        if (data.average !== undefined) setAverage(data.average);
        if (data.count !== undefined) setCount(data.count);
      } catch {
        // Rollback on failure
        setMyRating(prevMy);
        setAverage(prevAvg);
        setCount(prevCount);
      } finally {
        setSaving(false);
      }
    },
    [session, average, count, myRating, newsletterId]
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Average rating display */}
      <div className="flex items-center gap-2">
        <StarRating rating={Math.round(average)} readonly size="md" />
        <span className="text-sm font-medium text-[var(--color-text)]">
          {average.toFixed(1)}
        </span>
        <span className="text-sm text-[var(--color-text-secondary)]">
          ({count} {count === 1 ? "rating" : "ratings"})
        </span>
      </div>

      {/* User rating */}
      {session ? (
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--color-text-secondary)]">
            Your rating:
          </span>
          <StarRating
            rating={myRating}
            onChange={handleRate}
            size="md"
          />
          {saving && (
            <span className="text-xs text-[var(--color-text-secondary)]">
              Saving…
            </span>
          )}
        </div>
      ) : (
        <p className="text-sm text-[var(--color-text-secondary)]">
          <a
            href="/sign-in"
            className="text-[var(--color-primary)] font-medium hover:underline"
          >
            Sign in
          </a>{" "}
          to rate this newsletter.
        </p>
      )}
    </div>
  );
}
