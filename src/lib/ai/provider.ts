export interface AIProviderConfig {
  apiKey?: string;
  apiEndpoint?: string;
  model: string;
  settings?: Record<string, unknown>;
}

export interface SummarizeResult {
  summary: string;
  tokensUsed?: number;
}

export interface ExtractTagsResult {
  tags: string[];
  tokensUsed?: number;
}

export interface FormatContentResult {
  markdown: string;
  highlights: string[];
  tokensUsed?: number;
}

export interface AIProvider {
  id: string;
  name: string;
  initialize(config: AIProviderConfig): void;
  summarize(text: string, maxLength?: number): Promise<SummarizeResult>;
  extractTags(text: string, existingTags: string[]): Promise<ExtractTagsResult>;
  formatContent(html: string): Promise<FormatContentResult>;
  testConnection(): Promise<boolean>;
}

export type AIProviderType =
  | "OLLAMA"
  | "OPENAI"
  | "ANTHROPIC"
  | "GROQ"
  | "GEMINI"
  | "MISTRAL"
  | "CUSTOM";
