import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";

dotenv.config();

function envInt(key: string, fallback: number): number {
  const v = process.env[key];
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isNaN(n) ? fallback : n;
}

function envFloat(key: string, fallback: number): number {
  const v = process.env[key];
  if (!v) return fallback;
  const n = Number.parseFloat(v);
  return Number.isNaN(n) ? fallback : n;
}

export interface WorldviewLlmConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export interface WorldviewConfigOptions {
  dataDir?: string;
  apiHost?: string;
  apiPort?: number;
  llm?: WorldviewLlmConfig;
}

export const config = {
  llmApiKey: process.env.LLM_API_KEY ?? process.env.MW_LLM_API_KEY ?? "",
  llmBaseUrl: (process.env.LLM_BASE_URL ?? process.env.MW_LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, ""),
  llmModel: process.env.LLM_MODEL ?? process.env.MW_LLM_MODEL ?? "gpt-4o-mini",
  llmTimeout: envFloat("LLM_TIMEOUT", 180),
  llmMaxRetries: envInt("LLM_MAX_RETRIES", 3),
  llmMaxTokens: envInt("LLM_MAX_TOKENS", 8192),

  chunkTargetChars: envInt("CHUNK_TARGET_CHARS", 12_000),
  chunkOverlapChars: envInt("CHUNK_OVERLAP_CHARS", 800),
  maxConcurrentChunks: envInt("MAX_CONCURRENT_CHUNKS", 4),

  apiHost: process.env.API_HOST ?? "127.0.0.1",
  apiPort: envInt("API_PORT", 8000),
  dataDir: resolve(process.env.DATA_DIR ?? "./data"),
};

export function configureWorldview(options: WorldviewConfigOptions = {}): void {
  if (options.dataDir) {
    config.dataDir = resolve(options.dataDir);
  }
  if (options.apiHost) {
    config.apiHost = options.apiHost;
  }
  if (options.apiPort != null) {
    config.apiPort = options.apiPort;
  }
  if (options.llm?.apiKey) {
    config.llmApiKey = options.llm.apiKey;
  }
  if (options.llm?.baseUrl) {
    config.llmBaseUrl = options.llm.baseUrl.replace(/\/$/, "");
  }
  if (options.llm?.model) {
    config.llmModel = options.llm.model;
  }
}

export function ensureDirs(): void {
  mkdirSync(config.dataDir, { recursive: true });
  mkdirSync(resolve(config.dataDir, "jobs"), { recursive: true });
  mkdirSync(resolve(config.dataDir, "uploads"), { recursive: true });
}
