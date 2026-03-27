import { AnthropicProvider } from "./anthropic";
import { CustomProvider } from "./custom";
import { GeminiProvider } from "./gemini";
import { GroqProvider } from "./groq";
import { MistralProvider } from "./mistral";
import { OllamaProvider } from "./ollama";
import { OpenAIProvider } from "./openai";
import { AIProvider, AIProviderConfig, AIProviderType } from "./provider";

const providers: Record<AIProviderType, new () => AIProvider> = {
  OLLAMA: OllamaProvider,
  OPENAI: OpenAIProvider,
  ANTHROPIC: AnthropicProvider,
  GROQ: GroqProvider,
  GEMINI: GeminiProvider,
  MISTRAL: MistralProvider,
  CUSTOM: CustomProvider,
};

const defaultModels: Record<AIProviderType, string> = {
  OLLAMA: "llama3",
  OPENAI: "gpt-4o-mini",
  ANTHROPIC: "claude-sonnet-4-20250514",
  GROQ: "llama3-8b-8192",
  GEMINI: "gemini-1.5-flash",
  MISTRAL: "mistral-small-latest",
  CUSTOM: "custom-model",
};

const providerNames: Record<AIProviderType, string> = {
  OLLAMA: "Ollama",
  OPENAI: "OpenAI",
  ANTHROPIC: "Anthropic",
  GROQ: "Groq",
  GEMINI: "Gemini",
  MISTRAL: "Mistral",
  CUSTOM: "Custom",
};

export function createProvider(type: AIProviderType, config: AIProviderConfig): AIProvider {
  const ProviderClass = providers[type];
  if (!ProviderClass) {
    throw new Error(`Unknown AI provider: ${type}`);
  }

  const provider = new ProviderClass();
  provider.initialize(config);
  return provider;
}

export function getAvailableProviders(): { type: AIProviderType; name: string; defaultModel: string }[] {
  return (Object.keys(providers) as AIProviderType[]).map((type) => ({
    type,
    name: providerNames[type],
    defaultModel: defaultModels[type],
  }));
}
