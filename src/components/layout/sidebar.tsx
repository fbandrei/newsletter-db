"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

interface Tag {
  id: string;
  name: string;
}

interface Source {
  id: string;
  name: string;
}

interface SidebarProps {
  tags?: Tag[];
  sources?: Source[];
  selectedTags?: string[];
  selectedSources?: string[];
  onTagClick?: (tagId: string) => void;
  onSourceClick?: (sourceId: string) => void;
}

function SidebarSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-[var(--color-border)] py-4 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-sm font-semibold text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors"
      >
        {title}
        <svg
          className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

export function Sidebar({
  tags = [],
  sources = [],
  selectedTags = [],
  selectedSources = [],
  onTagClick,
  onSourceClick,
}: SidebarProps) {
  const { data: session } = useSession();

  return (
    <aside className="sticky top-20 space-y-0 pr-4">
      {/* Categories */}
      <SidebarSection title="Categories">
        <div className="flex flex-wrap gap-2">
          {tags.length > 0 ? (
            tags.map((tag) => (
              <button key={tag.id} onClick={() => onTagClick?.(tag.id)}>
                <Badge
                  variant={selectedTags.includes(tag.id) ? "primary" : "default"}
                  className="cursor-pointer transition-colors hover:opacity-80"
                >
                  {tag.name}
                </Badge>
              </button>
            ))
          ) : (
            <p className="text-xs text-[var(--color-text-secondary)]">
              No categories available
            </p>
          )}
        </div>
      </SidebarSection>

      {/* Sources */}
      <SidebarSection title="Sources">
        <ul className="space-y-1.5">
          {sources.length > 0 ? (
            sources.map((source) => (
              <li key={source.id}>
                <button
                  onClick={() => onSourceClick?.(source.id)}
                  className={cn(
                    "w-full rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
                    selectedSources.includes(source.id)
                      ? "bg-[var(--color-primary)] text-white"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text)]"
                  )}
                >
                  {source.name}
                </button>
              </li>
            ))
          ) : (
            <p className="text-xs text-[var(--color-text-secondary)]">
              No sources available
            </p>
          )}
        </ul>
      </SidebarSection>

      {/* Interests (auth only) */}
      {session?.user && (
        <SidebarSection title="Your Interests" defaultOpen={false}>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Personalized interests coming soon.
          </p>
        </SidebarSection>
      )}
    </aside>
  );
}
