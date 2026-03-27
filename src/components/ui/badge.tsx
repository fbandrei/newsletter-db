import { type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

const variantStyles = {
  default:
    "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]",
  primary:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  success:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  warning:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
};

interface BadgeProps {
  children: ReactNode;
  variant?: keyof typeof variantStyles;
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
