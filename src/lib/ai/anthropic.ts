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

type AnthropicResponse = {
  content?: Array<{ type?: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
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

export class AnthropicProvider implements AIProvider {
  id = "ANTHROPIC";
  name = "Anthropic";

  private apiKey = "";
  private endpoint = "https://api.anthropic.com/v1/messages";
  private model = "claude-sonnet-4-20250514";

  initialize(config: AIProviderConfig): void {
    this.apiKey = config.apiKey || "";
    this.endpoint = config.apiEndpoint?.replace(/\/$/, "") || "https://api.anthropic.com/v1/messages";
    this.model = config.model || "claude-sonnet-4-20250514";
  }

  private async message(prompt: string): Promise<{ text: string; tokensUsed?: number }> {
    if (!this.apiKey) {
      throw new Error("Anthropic API key is required");
    }

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        system: "You are an expert newsletter analyst.",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Anthropic request failed: ${response.status} ${response.statusText} ${details}`);
    }

    const data = (await response.json()) as AnthropicResponse;
    const text =
      data.content
        ?.filter((part) => part.type === "text")
        .map((part) => part.text || "")
        .join("\n")
        .trim() || "";

    return {
      text,
      tokensUsed:
        (typeof data.usage?.input_tokens === "number" ? data.usage.input_tokens : 0) +
        (typeof data.usage?.output_tokens === "number" ? data.usage.output_tokens : 0),
    };
  }

  async summarize(text: string, maxLength = 8000): Promise<SummarizeResult> {
    try {
      const result = await this.message(`${SUMMARY_PROMPT}\n\nNewsletter text:\n${text.slice(0, maxLength)}`);
      return { summary: result.text, tokensUsed: result.tokensUsed };
    } catch (error) {
      throw new Error(`Anthropic summarize failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async extractTags(text: string, existingTags: string[]): Promise<ExtractTagsResult> {
    try {
      const result = await this.message(
        `${TAGS_PROMPT} Existing tags to prefer if relevant: ${JSON.stringify(existingTags)}. Text:\n${text}`,
      );
      return { tags: safeJsonArray(result.text), tokensUsed: result.tokensUsed };
    } catch (error) {
      throw new Error(`Anthropic extractTags failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async formatContent(html: string): Promise<FormatContentResult> {
    try {
      const result = await this.message(`${FORMAT_PROMPT}\n\nNewsletter content:\n${html}`);
      return {
        markdown: result.text,
        highlights: extractHighlights(result.text),
        tokensUsed: result.tokensUsed,
      };
    } catch (error) {
      throw new Error(`Anthropic formatContent failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 8,
          messages: [{ role: "user", content: "ping" }],
        }),
      });
      if (!response.ok) return false;
      const data = (await response.json()) as AnthropicResponse;
      return Boolean(data.content?.length);
    } catch {
      return false;
    }
  }
}
