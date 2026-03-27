import { cn } from "@/lib/utils/cn";

const spinnerSizes = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-10 w-10",
};

interface SpinnerProps {
  size?: keyof typeof spinnerSizes;
  className?: string;
}

export function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <svg
      className={cn("animate-spin text-[var(--color-primary)]", spinnerSizes[size], className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export function LoadingCard() {
  return (
    <div className="animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
      <div className="mb-3 h-4 w-3/4 rounded bg-[var(--color-border)]" />
      <div className="mb-2 h-3 w-full rounded bg-[var(--color-border)]" />
      <div className="mb-2 h-3 w-5/6 rounded bg-[var(--color-border)]" />
      <div className="h-3 w-2/3 rounded bg-[var(--color-border)]" />
      <div className="mt-4 flex gap-2">
        <div className="h-5 w-14 rounded-full bg-[var(--color-border)]" />
        <div className="h-5 w-18 rounded-full bg-[var(--color-border)]" />
      </div>
    </div>
  );
}

interface LoadingPageProps {
  message?: string;
}

export function LoadingPage({ message }: LoadingPageProps) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <Spinner size="lg" />
      {message && (
        <p className="text-sm text-[var(--color-text-secondary)]">{message}</p>
      )}
    </div>
  );
}
