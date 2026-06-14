import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { config } from "./config";

export class LLMError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LLMError";
  }
}

function stripJsonFence(text: string): string {
  let s = text.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }
  return s.trim();
}

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

export function normalizeKeys<T>(obj: unknown): T {
  if (Array.isArray(obj)) {
    return obj.map((item) => normalizeKeys(item)) as T;
  }
  if (obj !== null && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      out[snakeToCamel(k)] = normalizeKeys(v);
    }
    return out as T;
  }
  return obj as T;
}

export interface ChatResult {
  content: string;
  finishReason: string;
}

export class LLMClient {
  private model: ChatOpenAI;

  constructor(options?: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    timeout?: number;
    maxRetries?: number;
    maxTokens?: number;
  }) {
    const apiKey = options?.apiKey ?? config.llmApiKey;
    if (!apiKey) {
      throw new LLMError("未配置 LLM_API_KEY");
    }

    this.model = new ChatOpenAI({
      model: options?.model ?? config.llmModel,
      apiKey,
      timeout: (options?.timeout ?? config.llmTimeout) * 1000,
      maxRetries: options?.maxRetries ?? config.llmMaxRetries,
      maxTokens: options?.maxTokens ?? config.llmMaxTokens,
      configuration: {
        baseURL: (options?.baseUrl ?? config.llmBaseUrl).replace(/\/$/, ""),
      },
    });
  }

  async chat(
    system: string,
    user: string,
    options?: { temperature?: number; jsonMode?: boolean },
  ): Promise<string> {
    const result = await this.chatWithMeta(system, user, options);
    return result.content;
  }

  async chatWithMeta(
    system: string,
    user: string,
    options?: { temperature?: number; jsonMode?: boolean },
  ): Promise<ChatResult> {
    const temperature = options?.temperature ?? 0.2;
    const jsonMode = options?.jsonMode ?? false;

    const invokeOptions: Record<string, unknown> = { temperature };
    if (jsonMode) {
      invokeOptions.response_format = { type: "json_object" };
    }

    const response = await this.model.invoke(
      [new SystemMessage(system), new HumanMessage(user)],
      invokeOptions,
    );

    const finishReason =
      (response.response_metadata?.finish_reason as string | undefined) ?? "unknown";

    const content =
      typeof response.content === "string"
        ? response.content
        : response.content
            .map((part) => (typeof part === "string" ? part : (part as { text?: string }).text ?? ""))
            .join("");

    return { content, finishReason };
  }

  async chatJson<T>(system: string, user: string): Promise<T> {
    let lastErr: unknown;
    let lastContent = "";

    for (let attempt = 1; attempt <= config.llmMaxRetries; attempt++) {
      try {
        const { content, finishReason } = await this.chatWithMeta(system, user, { jsonMode: true });
        const cleaned = stripJsonFence(content);
        lastContent = cleaned;

        if (finishReason === "length") {
          throw new SyntaxError(`响应被截断 (finish_reason=length, max_tokens=${config.llmMaxTokens})`);
        }

        return normalizeKeys<T>(JSON.parse(cleaned));
      } catch (err) {
        lastErr = err;
        console.warn(`JSON 解析失败 (attempt ${attempt}/${config.llmMaxRetries}):`, err);
      }
    }

    throw new LLMError(
      `LLM 返回非法 JSON（已重试 ${config.llmMaxRetries} 次）: ${String(lastErr)}\n内容: ${lastContent.slice(0, 800)}`,
    );
  }
}
