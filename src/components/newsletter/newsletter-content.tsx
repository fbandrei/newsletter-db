"use client";

import { useMemo } from "react";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

interface NewsletterContentProps {
  processedContent: string | null;
  rawHtml: string;
}

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat([
    "img",
    "h1",
    "h2",
    "h3",
    "figure",
    "figcaption",
    "video",
    "source",
    "iframe",
  ]),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    img: ["src", "alt", "width", "height", "loading"],
    a: ["href", "target", "rel"],
    iframe: ["src", "width", "height", "frameborder", "allowfullscreen"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        target: "_blank",
        rel: "noopener noreferrer",
      },
    }),
    img: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        loading: "lazy",
      },
    }),
  },
};

export function NewsletterContent({
  processedContent,
  rawHtml,
}: NewsletterContentProps) {
  const html = useMemo(() => {
    if (processedContent) {
      const converted = marked.parse(processedContent);
      // marked.parse returns string | Promise<string>; we handle the sync case
      const rawResult = typeof converted === "string" ? converted : "";
      return sanitizeHtml(rawResult, SANITIZE_OPTIONS);
    }
    return sanitizeHtml(rawHtml, SANITIZE_OPTIONS);
  }, [processedContent, rawHtml]);

  return (
    <article
      className="prose prose-slate dark:prose-invert max-w-none
        prose-headings:text-[var(--color-text)] prose-headings:font-semibold
        prose-p:text-[var(--color-text)] prose-p:leading-relaxed
        prose-a:text-[var(--color-primary)] prose-a:no-underline hover:prose-a:underline
        prose-img:rounded-lg prose-img:shadow-sm prose-img:mx-auto
        prose-blockquote:border-l-[var(--color-primary)] prose-blockquote:text-[var(--color-text-secondary)]
        prose-code:bg-[var(--color-bg-secondary)] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
        prose-pre:bg-[var(--color-bg-secondary)] prose-pre:border prose-pre:border-[var(--color-border)]
        prose-hr:border-[var(--color-border)]"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
