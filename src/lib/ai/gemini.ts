import {
  AIProvider,
  AIProviderConfig,
  ExtractTagsResult,
  FormatContentResult,
  SummarizeResult,
} from "./provider";

const SUMMARY_PROMPT =
  "Summarize the following newsletter in 2-3 concise sentences. Focus on the key takeaways and main topics covered.";
const TAGS_PROMPT =
  "Extract 3-7 topic tags from the following text. Return ONLY a JSON array of strings. Use lowercase.";
const FORMAT_PROMPT =
  "Convert the following newsletter content into clean, well-structured markdown. Preserve all links. Remove any promotional content or ads. Highlight key insights with bold text.";

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  usageMetadata?: { totalTokenCount?: number };
};

function safeJsonArray(text: string): string[] {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return [];
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string").map((tag) => tag.trim().toLowerCase())
      : [];
  } catch {
    return [];
  }
}

function extractHighlights(markdown: string): string[] {
  const matches = [...markdown.matchAll(/\*\*(.+?)\*\*/g)].map((m) => m[1].trim());
  return [...new Set(matches)].slice(0, 8);
}

export class GeminiProvider implements AIProvider {
  id = "GEMINI";
  name = "Gemini";

  private apiKey = "";
  private baseEndpoint = "https://generativelanguage.googleapis.com/v1beta";
  private model = "gemini-1.5-flash";

  initialize(config: AIProviderConfig): void {
    this.apiKey = config.apiKey || "";
    this.baseEndpoint = config.apiEndpoint?.replace(/\/$/, "") || "https://generativelanguage.googleapis.com/v1beta";
    this.model = config.model || "gemini-1.5-flash";
  }

  private async generate(prompt: string): Promise<{ text: string; tokensUsed?: number }> {
    if (!this.apiKey) {
      throw new Error("Gemini API key is required");
    }

    const response = await fetch(
      `${this.baseEndpoint}/models/${this.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2 },
        }),
      },
    );

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Gemini request failed: ${response.status} ${response.statusText} ${details}`);
    }

    const data = (await response.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    return { text, tokensUsed: data.usageMetadata?.totalTokenCount };
  }

  async summarize(text: string, maxLength = 8000): Promise<SummarizeResult> {
    try {
      const result = await this.generate(`${SUMMARY_PROMPT}\n\nNewsletter text:\n${text.slice(0, maxLength)}`);
      return { summary: result.text, tokensUsed: result.tokensUsed };
    } catch (error) {
      throw new Error(`Gemini summarize failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async extractTags(text: string, existingTags: string[]): Promise<ExtractTagsResult> {
    try {
      const result = await this.generate(
        `${TAGS_PROMPT} Existing tags to prefer if relevant: ${JSON.stringify(existingTags)}. Text:\n${text}`,
      );
      return { tags: safeJsonArray(result.text), tokensUsed: result.tokensUsed };
    } catch (error) {
      throw new Error(`Gemini extractTags failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async formatContent(html: string): Promise<FormatContentResult> {
    try {
      const result = await this.generate(`${FORMAT_PROMPT}\n\nNewsletter content:\n${html}`);
      return {
        markdown: result.text,
        highlights: extractHighlights(result.text),
        tokensUsed: result.tokensUsed,
      };
    } catch (error) {
      throw new Error(`Gemini formatContent failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const response = await fetch(`${this.baseEndpoint}/models?key=${encodeURIComponent(this.apiKey)}`);
      return response.ok;
    } catch {
      return false;
    }
  }
}
