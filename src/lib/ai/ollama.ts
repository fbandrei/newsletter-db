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

export class OllamaProvider implements AIProvider {
  id = "OLLAMA";
  name = "Ollama";

  private baseUrl = "http://localhost:11434";
  private model = "llama3";

  initialize(config: AIProviderConfig): void {
    this.baseUrl = config.apiEndpoint?.replace(/\/$/, "") || "http://localhost:11434";
    this.model = config.model || "llama3";
  }

  private async generate(prompt: string): Promise<{ text: string; tokensUsed?: number }> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.model, prompt, stream: false }),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      response?: string;
      eval_count?: number;
      prompt_eval_count?: number;
    };

    return {
      text: data.response?.trim() || "",
      tokensUsed:
        (typeof data.eval_count === "number" ? data.eval_count : 0) +
        (typeof data.prompt_eval_count === "number" ? data.prompt_eval_count : 0),
    };
  }

  async summarize(text: string, maxLength = 8000): Promise<SummarizeResult> {
    try {
      const prompt = `${SUMMARY_PROMPT}\n\nNewsletter text:\n${text.slice(0, maxLength)}`;
      const result = await this.generate(prompt);
      return { summary: result.text, tokensUsed: result.tokensUsed };
    } catch (error) {
      throw new Error(`Ollama summarize failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async extractTags(text: string, existingTags: string[]): Promise<ExtractTagsResult> {
    try {
      const prompt = `${TAGS_PROMPT} Existing tags to prefer if relevant: ${JSON.stringify(existingTags)}. Text:\n${text}`;
      const result = await this.generate(prompt);
      return { tags: safeJsonArray(result.text), tokensUsed: result.tokensUsed };
    } catch (error) {
      throw new Error(`Ollama extractTags failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async formatContent(html: string): Promise<FormatContentResult> {
    try {
      const prompt = `${FORMAT_PROMPT}\n\nNewsletter content:\n${html}`;
      const result = await this.generate(prompt);
      return {
        markdown: result.text,
        highlights: extractHighlights(result.text),
        tokensUsed: result.tokensUsed,
      };
    } catch (error) {
      throw new Error(`Ollama formatContent failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }
}
