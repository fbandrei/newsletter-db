"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export function PaywallOverlay() {
  return (
    <div className="relative">
      {/* Gradient fade overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--color-bg)]/80 to-[var(--color-bg)]" />

      {/* Content */}
      <div className="relative flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="rounded-full bg-amber-100 dark:bg-amber-900/30 p-3 mb-4">
          <svg
            className="h-8 w-8 text-amber-600 dark:text-amber-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
            />
          </svg>
        </div>

        <h3 className="text-xl font-bold text-[var(--color-text)] mb-2">
          You&apos;ve reached your free reading limit this week
        </h3>

        <p className="text-sm text-[var(--color-text-secondary)] mb-6 max-w-md">
          Free accounts include <strong>3 free newsletters per week</strong>.
          Upgrade to Premium for unlimited access to all content.
        </p>

        <Link href="/pricing">
          <Button size="lg">Upgrade to Premium</Button>
        </Link>

        <p className="mt-4 text-xs text-[var(--color-text-secondary)]">
          Your free limit resets every Monday.
        </p>
      </div>
    </div>
  );
}
