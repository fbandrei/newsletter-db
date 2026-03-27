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

type CompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { total_tokens?: number };
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

export class CustomProvider implements AIProvider {
  id = "CUSTOM";
  name = "Custom";

  private apiKey = "";
  private endpoint = "http://localhost:1234/v1/chat/completions";
  private model = "custom-model";

  initialize(config: AIProviderConfig): void {
    this.apiKey = config.apiKey || "";
    this.endpoint = config.apiEndpoint || "http://localhost:1234/v1/chat/completions";
    this.model = config.model || "custom-model";
  }

  private async chat(prompt: string): Promise<{ text: string; tokensUsed?: number }> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: "You are an expert newsletter analyst." },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Custom provider request failed: ${response.status} ${response.statusText} ${details}`);
    }

    const data = (await response.json()) as CompletionResponse;
    return {
      text: data.choices?.[0]?.message?.content?.trim() || "",
      tokensUsed: data.usage?.total_tokens,
    };
  }

  async summarize(text: string, maxLength = 8000): Promise<SummarizeResult> {
    try {
      const result = await this.chat(`${SUMMARY_PROMPT}\n\nNewsletter text:\n${text.slice(0, maxLength)}`);
      return { summary: result.text, tokensUsed: result.tokensUsed };
    } catch (error) {
      throw new Error(`Custom summarize failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async extractTags(text: string, existingTags: string[]): Promise<ExtractTagsResult> {
    try {
      const result = await this.chat(
        `${TAGS_PROMPT} Existing tags to prefer if relevant: ${JSON.stringify(existingTags)}. Text:\n${text}`,
      );
      return { tags: safeJsonArray(result.text), tokensUsed: result.tokensUsed };
    } catch (error) {
      throw new Error(`Custom extractTags failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async formatContent(html: string): Promise<FormatContentResult> {
    try {
      const result = await this.chat(`${FORMAT_PROMPT}\n\nNewsletter content:\n${html}`);
      return {
        markdown: result.text,
        highlights: extractHighlights(result.text),
        tokensUsed: result.tokensUsed,
      };
    } catch (error) {
      throw new Error(`Custom formatContent failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const result = await this.chat("Reply only with: pong");
      return result.text.length > 0;
    } catch {
      return false;
    }
  }
}
