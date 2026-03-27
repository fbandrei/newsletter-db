"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  href?: string;
}

export function Card({ children, className, onClick, href }: CardProps) {
  const classes = cn(
    "rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5 shadow-sm transition-shadow hover:shadow-md",
    (onClick || href) && "cursor-pointer",
    className
  );

  if (href) {
    return (
      <a href={href} className={cn(classes, "block no-underline")}>
        {children}
      </a>
    );
  }

  return (
    <div className={classes} onClick={onClick} role={onClick ? "button" : undefined}>
      {children}
    </div>
  );
}
