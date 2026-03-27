import * as cheerio from "cheerio";
import sanitizeHtml from "sanitize-html";

import { AIProvider, AIProviderConfig, AIProviderType } from "./provider";
import { createProvider } from "./registry";
import prisma from "../db";
import {
  AIProviderType as PrismaAIProviderType,
  Prisma,
  ProcessingStatus,
} from "@/generated/prisma/client";

export interface PipelineResult {
  summary: string;
  tags: string[];
  processedContent: string;
  highlights: string[];
  tokensUsed: number;
  durationMs: number;
}

type ProviderConfigRow = {
  provider: PrismaAIProviderType;
  apiKey: string | null;
  apiEndpoint: string | null;
  model: string;
  settings: Prisma.JsonValue;
};

function toRecord(value: Prisma.JsonValue): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function toRuntimeConfig(config: ProviderConfigRow): AIProviderConfig {
  return {
    apiKey: config.apiKey ?? undefined,
    apiEndpoint: config.apiEndpoint ?? undefined,
    model: config.model,
    settings: toRecord(config.settings),
  };
}

function createRuntimeProvider(config: ProviderConfigRow): AIProvider {
  return createProvider(config.provider as AIProviderType, toRuntimeConfig(config));
}

async function runWithProvider(
  providerConfig: ProviderConfigRow,
  plainText: string,
  cleanedHtml: string,
  existingTags: string[],
): Promise<Omit<PipelineResult, "durationMs">> {
  const provider = createRuntimeProvider(providerConfig);

  const summaryResult = await provider.summarize(plainText);
  const tagsResult = await provider.extractTags(plainText, existingTags);
  const formatResult = await provider.formatContent(cleanedHtml);

  const tags = [...new Set(tagsResult.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))].slice(0, 7);
  const highlights = [...new Set(formatResult.highlights.map((h) => h.trim()).filter(Boolean))].slice(0, 10);

  return {
    summary: summaryResult.summary,
    tags,
    processedContent: formatResult.markdown,
    highlights,
    tokensUsed:
      (summaryResult.tokensUsed || 0) + (tagsResult.tokensUsed || 0) + (formatResult.tokensUsed || 0),
  };
}

export async function processNewsletter(newsletterId: string): Promise<PipelineResult> {
  const startedAt = Date.now();

  const newsletter = await prisma.newsletter.findUnique({ where: { id: newsletterId } });
  if (!newsletter) {
    throw new Error(`Newsletter not found: ${newsletterId}`);
  }

  const [primaryConfig, fallbackConfig, existingTagsFromDb] = await Promise.all([
    prisma.aIProviderConfig.findFirst({ where: { isActive: true, isPrimary: true } }),
    prisma.aIProviderConfig.findFirst({ where: { isActive: true, isFallback: true } }),
    prisma.tag.findMany({ select: { name: true } }),
  ]);

  if (!primaryConfig) {
    throw new Error("No active primary AI provider is configured");
  }

  const cleanedHtml = cleanHtml(newsletter.rawHtml);
  const plainText = extractText(cleanedHtml) || newsletter.rawText || extractText(newsletter.rawHtml);
  const existingTags = existingTagsFromDb.map((tag) => tag.name.toLowerCase());

  let activeConfig: ProviderConfigRow = primaryConfig;
  let result: Omit<PipelineResult, "durationMs">;
  let primaryError: Error | null = null;

  try {
    result = await runWithProvider(primaryConfig, plainText, cleanedHtml, existingTags);
  } catch (error) {
    primaryError = error instanceof Error ? error : new Error("Primary provider failed");

    await prisma.aIProcessingLog.create({
      data: {
        newsletterId,
        provider: primaryConfig.provider,
        model: primaryConfig.model,
        status: ProcessingStatus.FAILED,
        errorMessage: primaryError.message,
        durationMs: Date.now() - startedAt,
      },
    });

    if (!fallbackConfig || fallbackConfig.id === primaryConfig.id) {
      throw primaryError;
    }

    activeConfig = fallbackConfig;
    result = await runWithProvider(fallbackConfig, plainText, cleanedHtml, existingTags);
  }

  const durationMs = Date.now() - startedAt;

  await prisma.$transaction(async (tx) => {
    await tx.newsletter.update({
      where: { id: newsletterId },
      data: {
        summary: result.summary,
        processedContent: result.processedContent,
        highlights: result.highlights,
        rawText: plainText,
        isProcessed: true,
      },
    });

    const tagRows = await Promise.all(
      result.tags.map((tagName) => {
        const normalized = tagName.toLowerCase().trim();
        return tx.tag.upsert({
          where: { name: normalized },
          update: {},
          create: {
            name: normalized,
            slug: normalized
              .replace(/[^a-z0-9\s-]/g, "")
              .trim()
              .replace(/\s+/g, "-"),
          },
          select: { id: true },
        });
      }),
    );

    await tx.newsletterTag.deleteMany({ where: { newsletterId } });
    if (tagRows.length > 0) {
      await tx.newsletterTag.createMany({
        data: tagRows.map((tag) => ({ newsletterId, tagId: tag.id })),
        skipDuplicates: true,
      });
    }

    await tx.aIProcessingLog.create({
      data: {
        newsletterId,
        provider: activeConfig.provider,
        model: activeConfig.model,
        tokensUsed: result.tokensUsed || null,
        durationMs,
        status: ProcessingStatus.COMPLETED,
      },
    });
  });

  return {
    ...result,
    durationMs,
  };
}

export function cleanHtml(html: string): string {
  const sanitized = sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.filter((tag) => !["style", "script"].includes(tag)),
    allowedAttributes: {
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "width", "height"],
      "*": ["class", "id"],
    },
    disallowedTagsMode: "discard",
  });

  const $ = cheerio.load(sanitized);

  $("img").each((_, el) => {
    const img = $(el);
    const width = Number(img.attr("width") || 0);
    const height = Number(img.attr("height") || 0);
    const style = (img.attr("style") || "").toLowerCase();
    const src = (img.attr("src") || "").toLowerCase();

    const tinyBySize = width > 0 && height > 0 && width <= 1 && height <= 1;
    const tinyByStyle = /(?:width|height)\s*:\s*1px/.test(style);
    const trackingSource = /pixel|open|track|analytics/.test(src);

    if (tinyBySize || tinyByStyle || trackingSource) {
      img.remove();
    }
  });

  $("a").each((_, el) => {
    const link = $(el);
    const text = link.text().toLowerCase();
    const href = (link.attr("href") || "").toLowerCase();
    if (/unsubscribe|opt\s*out|manage\s*preferences|email\s*preferences/.test(`${text} ${href}`)) {
      link.remove();
    }
  });

  $("footer, .footer, [id*=footer], [class*=unsubscribe], [id*=unsubscribe]").remove();

  $("p, div, span, td, li").each((_, el) => {
    const node = $(el);
    const text = node.text().toLowerCase().replace(/\s+/g, " ").trim();
    if (
      text &&
      /unsubscribe|manage preferences|you received this email|all rights reserved|view in browser/.test(text)
    ) {
      node.remove();
    }
  });

  return $.html();
}

export function extractText(html: string): string {
  const $ = cheerio.load(html);
  return (
    $("body").text().replace(/\s+/g, " ").trim() ||
    $.text().replace(/\s+/g, " ").trim()
  );
}
