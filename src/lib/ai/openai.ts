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

type OpenAIResponse = {
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

export class OpenAIProvider implements AIProvider {
  id = "OPENAI";
  name = "OpenAI";

  private apiKey = "";
  private endpoint = "https://api.openai.com/v1";
  private model = "gpt-4o-mini";

  initialize(config: AIProviderConfig): void {
    this.apiKey = config.apiKey || "";
    this.endpoint = config.apiEndpoint?.replace(/\/$/, "") || "https://api.openai.com/v1";
    this.model = config.model || "gpt-4o-mini";
  }

  private async chat(prompt: string): Promise<{ text: string; tokensUsed?: number }> {
    if (!this.apiKey) {
      throw new Error("OpenAI API key is required");
    }

    const response = await fetch(`${this.endpoint}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
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
      throw new Error(`OpenAI request failed: ${response.status} ${response.statusText} ${details}`);
    }

    const data = (await response.json()) as OpenAIResponse;
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
      throw new Error(`OpenAI summarize failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async extractTags(text: string, existingTags: string[]): Promise<ExtractTagsResult> {
    try {
      const result = await this.chat(
        `${TAGS_PROMPT} Existing tags to prefer if relevant: ${JSON.stringify(existingTags)}. Text:\n${text}`,
      );
      return { tags: safeJsonArray(result.text), tokensUsed: result.tokensUsed };
    } catch (error) {
      throw new Error(`OpenAI extractTags failed: ${error instanceof Error ? error.message : "Unknown error"}`);
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
      throw new Error(`OpenAI formatContent failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const response = await fetch(`${this.endpoint}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
