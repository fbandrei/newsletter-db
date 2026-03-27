"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AIProviderType } from "@/generated/prisma/enums";

type ProviderType = (typeof AIProviderType)[keyof typeof AIProviderType];
type ConnectionState = "idle" | "testing" | "connected" | "error";

interface ProviderConfig {
  id: string;
  provider: ProviderType;
  name: string;
  isActive: boolean;
  isPrimary: boolean;
  isFallback: boolean;
  apiKey: string;
  apiEndpoint: string | null;
  model: string;
}

interface SettingsResponse {
  providers: ProviderConfig[];
  processingSettings: {
    maxSummaryLength: number;
    maxTagsPerNewsletter: number;
  };
}

const providerModels: Record<ProviderType, string[]> = {
  OLLAMA: ["llama3", "llama3.1", "mistral", "mixtral"],
  OPENAI: ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4.1"],
  ANTHROPIC: ["claude-sonnet-4-20250514", "claude-3-5-sonnet-latest"],
  GROQ: ["llama3-8b-8192", "llama-3.3-70b-versatile"],
  GEMINI: ["gemini-1.5-flash", "gemini-1.5-pro"],
  MISTRAL: ["mistral-small-latest", "mistral-large-latest"],
  CUSTOM: ["custom-model"],
};

const providerIcons: Record<ProviderType, string> = {
  OLLAMA: "🦙",
  OPENAI: "🤖",
  ANTHROPIC: "🧠",
  GROQ: "⚡",
  GEMINI: "✨",
  MISTRAL: "🌪️",
  CUSTOM: "🛠️",
};

export default function AdminAISettingsPage() {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [processingSettings, setProcessingSettings] = useState({
    maxSummaryLength: 800,
    maxTagsPerNewsletter: 7,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [connectionState, setConnectionState] = useState<Record<string, ConnectionState>>({});

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch("/api/admin/ai-settings", { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to load AI settings");

        const data = (await response.json()) as SettingsResponse;
        if (!active) return;
        setProviders(data.providers);
        setProcessingSettings(data.processingSettings);
      } catch {
        if (!active) return;
        setError("Unable to load AI settings.");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const primaryCount = useMemo(
    () => providers.filter((provider) => provider.isPrimary).length,
    [providers],
  );

  function updateProvider(id: string, patch: Partial<ProviderConfig>) {
    setProviders((prev) =>
      prev.map((provider) => (provider.id === id ? { ...provider, ...patch } : provider)),
    );
  }

  function setPrimary(id: string) {
    setProviders((prev) =>
      prev.map((provider) => ({ ...provider, isPrimary: provider.id === id })),
    );
  }

  async function testConnection(provider: ProviderConfig) {
    setConnectionState((prev) => ({ ...prev, [provider.id]: "testing" }));
    try {
      const response = await fetch("/api/admin/ai-settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: provider.provider,
          apiKey: provider.apiKey,
          apiEndpoint: provider.apiEndpoint,
          model: provider.model,
        }),
      });

      const data = (await response.json()) as { success: boolean };
      setConnectionState((prev) => ({
        ...prev,
        [provider.id]: data.success ? "connected" : "error",
      }));
    } catch {
      setConnectionState((prev) => ({ ...prev, [provider.id]: "error" }));
    }
  }

  async function save() {
    setError(null);
    setMessage(null);

    if (primaryCount !== 1) {
      setError("Exactly one provider must be marked as primary.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/admin/ai-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providers, processingSettings }),
      });

      const data = (await response.json()) as SettingsResponse & { error?: string };
      if (!response.ok) {
        setError(data.error || "Failed to save AI settings.");
        return;
      }

      setProviders(data.providers);
      setProcessingSettings(data.processingSettings);
      setMessage("AI settings saved successfully.");
    } catch {
      setError("Failed to save AI settings.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--color-text-secondary)]">Loading AI provider settings...</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">AI Provider Settings</h1>

      <div className="grid gap-4 xl:grid-cols-2">
        {providers.map((provider) => {
          const state = connectionState[provider.id] || "idle";
          return (
            <Card key={provider.id}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">
                  <span className="mr-2">{providerIcons[provider.provider]}</span>
                  {provider.name}
                </h2>
                {state === "connected" && <Badge variant="success">Connected</Badge>}
                {state === "error" && <Badge className="bg-red-100 text-red-700">Error</Badge>}
                {state === "testing" && <Badge variant="warning">Testing...</Badge>}
              </div>

              <div className="mt-4 grid gap-3">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={provider.isActive}
                    onChange={(e) => updateProvider(provider.id, { isActive: e.target.checked })}
                  />
                  Active
                </label>

                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="primary-provider"
                    checked={provider.isPrimary}
                    onChange={() => setPrimary(provider.id)}
                  />
                  Primary
                </label>

                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={provider.isFallback}
                    onChange={(e) =>
                      updateProvider(provider.id, { isFallback: e.target.checked })
                    }
                  />
                  Fallback
                </label>

                <Input
                  label="API Key"
                  type={showKeys[provider.id] ? "text" : "password"}
                  value={provider.apiKey || ""}
                  onChange={(e) => updateProvider(provider.id, { apiKey: e.target.value })}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setShowKeys((prev) => ({ ...prev, [provider.id]: !prev[provider.id] }))
                  }
                >
                  {showKeys[provider.id] ? "Hide key" : "Show key"}
                </Button>

                {provider.provider === AIProviderType.CUSTOM && (
                  <Input
                    label="API Endpoint"
                    value={provider.apiEndpoint || ""}
                    onChange={(e) => updateProvider(provider.id, { apiEndpoint: e.target.value })}
                    placeholder="https://api.example.com/v1/chat/completions"
                  />
                )}

                <label className="space-y-1 text-sm">
                  <span className="block font-medium">Model</span>
                  <select
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
                    value={provider.model}
                    onChange={(e) => updateProvider(provider.id, { model: e.target.value })}
                  >
                    {[...new Set([...providerModels[provider.provider], provider.model])].map(
                      (model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <Button variant="secondary" onClick={() => testConnection(provider)}>
                  Test connection
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <Card>
        <h2 className="text-lg font-semibold">Processing settings</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Input
            label="Max summary length"
            type="number"
            min={100}
            value={processingSettings.maxSummaryLength}
            onChange={(e) =>
              setProcessingSettings((prev) => ({
                ...prev,
                maxSummaryLength: Number(e.target.value) || 0,
              }))
            }
          />
          <Input
            label="Max tags per newsletter"
            type="number"
            min={1}
            max={20}
            value={processingSettings.maxTagsPerNewsletter}
            onChange={(e) =>
              setProcessingSettings((prev) => ({
                ...prev,
                maxTagsPerNewsletter: Number(e.target.value) || 0,
              }))
            }
          />
        </div>
      </Card>

      {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}
      {message && <p className="text-sm text-green-600 dark:text-green-300">{message}</p>}

      <Button onClick={save} loading={saving}>
        Save AI Settings
      </Button>
    </div>
  );
}
