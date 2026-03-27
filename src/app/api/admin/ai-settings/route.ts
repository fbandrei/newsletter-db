import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { AIProviderType } from "@/generated/prisma/enums";
import { getAvailableProviders } from "@/lib/ai/registry";

type ProviderType = (typeof AIProviderType)[keyof typeof AIProviderType];

type IncomingProvider = {
  id?: string;
  provider: ProviderType;
  name: string;
  apiKey?: string;
  apiEndpoint?: string | null;
  model: string;
  isActive: boolean;
  isPrimary: boolean;
  isFallback: boolean;
};

const defaultProcessingSettings = {
  maxSummaryLength: 800,
  maxTagsPerNewsletter: 7,
};

function requireSecret() {
  const secret =
    process.env.AI_SETTINGS_ENCRYPTION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "dev-only-secret-change-me";
  return crypto.createHash("sha256").update(secret).digest();
}

function encryptApiKey(value: string): string {
  const key = requireSecret();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

function maskApiKey(value: string | null): string {
  if (!value) return "";
  return `••••••••${value.slice(-4)}`;
}

async function ensureAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return null;
  }
  return session;
}

function safeProcessingSettings(value: unknown) {
  if (!value || typeof value !== "object") return defaultProcessingSettings;
  const processing = (value as { processing?: unknown }).processing;
  if (!processing || typeof processing !== "object") return defaultProcessingSettings;

  return {
    maxSummaryLength:
      Number((processing as { maxSummaryLength?: unknown }).maxSummaryLength) ||
      defaultProcessingSettings.maxSummaryLength,
    maxTagsPerNewsletter:
      Number((processing as { maxTagsPerNewsletter?: unknown }).maxTagsPerNewsletter) ||
      defaultProcessingSettings.maxTagsPerNewsletter,
  };
}

function normalizeProviders(
  configs: Array<{
    id: string;
    provider: ProviderType;
    name: string;
    apiKey: string | null;
    apiEndpoint: string | null;
    model: string;
    isActive: boolean;
    isPrimary: boolean;
    isFallback: boolean;
    settings: unknown;
    updatedAt: Date;
  }>,
) {
  const byProvider = new Map<ProviderType, (typeof configs)[number]>();
  for (const config of configs) {
    const existing = byProvider.get(config.provider);
    if (!existing || existing.updatedAt < config.updatedAt) {
      byProvider.set(config.provider, config);
    }
  }

  return Object.values(AIProviderType).map((provider) => {
    const existing = byProvider.get(provider);
    if (existing) {
      return {
        id: existing.id,
        provider: existing.provider,
        name: existing.name,
        apiKey: maskApiKey(existing.apiKey),
        apiEndpoint: existing.apiEndpoint,
        model: existing.model,
        isActive: existing.isActive,
        isPrimary: existing.isPrimary,
        isFallback: existing.isFallback,
      };
    }

    const template = getAvailableProviders().find((item) => item.type === provider);
    return {
      id: `missing-${provider}`,
      provider,
      name: template?.name || provider,
      apiKey: "",
      apiEndpoint: provider === AIProviderType.CUSTOM ? "" : null,
      model: template?.defaultModel || "custom-model",
      isActive: false,
      isPrimary: false,
      isFallback: false,
    };
  });
}

export async function GET() {
  if (!(await ensureAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const templates = getAvailableProviders();
  const existing = await prisma.aIProviderConfig.findMany({
    orderBy: { updatedAt: "desc" },
  });

  const existingProviders = new Set(existing.map((config) => config.provider));
  const missingProviders = templates.filter(
    (template) => !existingProviders.has(template.type),
  );

  if (missingProviders.length > 0) {
    await prisma.aIProviderConfig.createMany({
      data: missingProviders.map((template, index) => ({
        provider: template.type,
        name: template.name,
        model: template.defaultModel,
        isActive: index === 0,
        isPrimary: index === 0,
      })),
    });
  }

  const configs = await prisma.aIProviderConfig.findMany({
    orderBy: { updatedAt: "desc" },
  });

  const primaryConfig = configs.find((config) => config.isPrimary);
  const processingSettings = safeProcessingSettings(primaryConfig?.settings);

  return NextResponse.json({
    providers: normalizeProviders(configs),
    processingSettings,
  });
}

export async function PUT(req: NextRequest) {
  if (!(await ensureAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as {
      providers?: IncomingProvider[];
      processingSettings?: {
        maxSummaryLength?: number;
        maxTagsPerNewsletter?: number;
      };
    };

    const providers = body.providers || [];
    if (providers.length === 0) {
      return NextResponse.json({ error: "No providers were submitted." }, { status: 400 });
    }

    const primaryCount = providers.filter((provider) => provider.isPrimary).length;
    if (primaryCount !== 1) {
      return NextResponse.json({ error: "Exactly one provider must be primary." }, { status: 400 });
    }

    const processingSettings = {
      maxSummaryLength:
        Number(body.processingSettings?.maxSummaryLength) ||
        defaultProcessingSettings.maxSummaryLength,
      maxTagsPerNewsletter:
        Number(body.processingSettings?.maxTagsPerNewsletter) ||
        defaultProcessingSettings.maxTagsPerNewsletter,
    };

    const updated = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const provider of providers) {
        const existing = provider.id
          ? await tx.aIProviderConfig.findUnique({ where: { id: provider.id } })
          : await tx.aIProviderConfig.findFirst({ where: { provider: provider.provider } });

        let encryptedKey: string | null = existing?.apiKey || null;
        if (provider.apiKey && !provider.apiKey.includes("•")) {
          encryptedKey = encryptApiKey(provider.apiKey);
        } else if (provider.apiKey === "") {
          encryptedKey = null;
        }

        const data = {
          provider: provider.provider,
          name: provider.name,
          apiKey: encryptedKey,
          apiEndpoint: provider.apiEndpoint || null,
          model: provider.model,
          isActive: provider.isActive,
          isPrimary: provider.isPrimary,
          isFallback: provider.isFallback,
          settings: {
            processing: processingSettings,
          },
        };

        if (existing) {
          results.push(await tx.aIProviderConfig.update({ where: { id: existing.id }, data }));
          continue;
        }

        results.push(await tx.aIProviderConfig.create({ data }));
      }
      return results;
    });

    return NextResponse.json({
      providers: normalizeProviders(updated),
      processingSettings,
    });
  } catch {
    return NextResponse.json({ error: "Failed to update AI settings." }, { status: 500 });
  }
}
