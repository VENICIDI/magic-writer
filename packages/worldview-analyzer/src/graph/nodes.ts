import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { chunkNovel } from "../chunker";
import type { LLMClient } from "../llm";
import {
  BATCH_MERGE_SYSTEM,
  EXTRACT_SYSTEM,
  MERGE_SYSTEM,
  SYNTHESIZE_SYSTEM,
  batchMergeUser,
  extractUser,
  mergeUser,
  synthesizeUser,
} from "../prompts";
import { runPoolDynamic } from "../pool";
import { runtimeSettings } from "../runtime-settings";
import type { AnalysisJob, ChunkExtraction, MergedWorldview } from "../types";
import type { WorldviewGraphConfigurable, WorldviewGraphState } from "./state";
import { toExtraction, toMergedWorldview } from "./transform";

const MERGE_BATCH_SIZE = 20;

function getConfigurable(config?: LangGraphRunnableConfig): WorldviewGraphConfigurable {
  const cfg = config?.configurable as WorldviewGraphConfigurable | undefined;
  if (!cfg?.job) {
    throw new Error("LangGraph configurable 缺少 job");
  }
  return cfg;
}

function updateJob(
  config: LangGraphRunnableConfig | undefined,
  patch: {
    status?: AnalysisJob["progress"]["status"];
    message?: string;
    percent?: number;
    stage?: string;
    processedChunks?: number;
    totalChunks?: number;
  },
): void {
  const { job, onProgress } = getConfigurable(config);
  if (patch.status) job.progress.status = patch.status;
  if (patch.message) job.progress.message = patch.message;
  if (patch.stage) job.progress.currentStage = patch.stage;
  if (patch.percent !== undefined) job.progress.percent = patch.percent;
  if (patch.processedChunks !== undefined) job.progress.processedChunks = patch.processedChunks;
  if (patch.totalChunks !== undefined) job.progress.totalChunks = patch.totalChunks;
  onProgress?.(job);
}

async function extractOne(
  llm: LLMClient,
  chunkIndex: number,
  chunkTitle: string,
  chunkText: string,
  totalChunks: number,
  totalChars: number,
): Promise<ChunkExtraction> {
  const user = extractUser({
    chunkTitle,
    chunkIndex: chunkIndex + 1,
    totalChunks,
    totalChars,
    chunkText,
  });
  const data = await llm.chatJson<ChunkExtraction>(EXTRACT_SYSTEM, user);
  return toExtraction({ ...data, chunkIndex, chunkTitle });
}

async function mergeExtractions(llm: LLMClient, extractions: ChunkExtraction[]): Promise<MergedWorldview> {
  const user = mergeUser(extractions.length, JSON.stringify(extractions, null, 2));
  const data = await llm.chatJson<MergedWorldview>(MERGE_SYSTEM, user);
  return toMergedWorldview(data);
}

async function hierarchicalMerge(llm: LLMClient, extractions: ChunkExtraction[]): Promise<MergedWorldview> {
  if (extractions.length <= MERGE_BATCH_SIZE) {
    return mergeExtractions(llm, extractions);
  }

  const batches: ChunkExtraction[][] = [];
  for (let i = 0; i < extractions.length; i += MERGE_BATCH_SIZE) {
    batches.push(extractions.slice(i, i + MERGE_BATCH_SIZE));
  }

  const intermediate: ChunkExtraction[] = [];
  for (const batch of batches) {
    const user = batchMergeUser(batch.length, JSON.stringify(batch, null, 2));
    const data = await llm.chatJson<ChunkExtraction>(BATCH_MERGE_SYSTEM, user);
    intermediate.push(toExtraction(data));
  }

  return mergeExtractions(llm, intermediate);
}

export function createGraphNodes(llm: LLMClient) {
  const chunkNode = async (
    state: WorldviewGraphState,
    config?: LangGraphRunnableConfig,
  ): Promise<Partial<WorldviewGraphState>> => {
    const { job } = getConfigurable(config);

    updateJob(config, {
      status: "chunking",
      message: "正在切分文本...",
      percent: 5,
      stage: "chunking",
    });

    const chunks = chunkNovel(state.text);
    job.chunks = chunks;
    updateJob(config, {
      message: `已切分为 ${chunks.length} 个分析块`,
      percent: 10,
      totalChunks: chunks.length,
    });

    if (!chunks.length) throw new Error("文本为空或无法切分");

    return { chunks };
  };

  const extractNode = async (
    state: WorldviewGraphState,
    config?: LangGraphRunnableConfig,
  ): Promise<Partial<WorldviewGraphState>> => {
    const { job } = getConfigurable(config);
    const total = state.chunks.length;

    updateJob(config, {
      status: "extracting",
      message: "正在逐块提取（主线/世界观/角色/物品）...",
      percent: 15,
      stage: "extracting",
    });

    let completed = 0;
    job.extractions = new Array(total);

    const tasks = state.chunks.map((chunk, idx) => async () => {
      const extraction = await extractOne(
        llm,
        idx,
        chunk.title,
        chunk.text,
        total,
        job.totalChars,
      );
      job.extractions[idx] = extraction;
      completed += 1;
      updateJob(config, {
        message: `已提取 ${completed}/${total} 块`,
        percent: 15 + (completed / total) * 55,
        processedChunks: completed,
      });
      return extraction;
    });

    const extractions = await runPoolDynamic(tasks, () => runtimeSettings.maxConcurrentChunks);
    job.extractions = extractions;

    return { extractions };
  };

  const mergeNode = async (
    state: WorldviewGraphState,
    config?: LangGraphRunnableConfig,
  ): Promise<Partial<WorldviewGraphState>> => {
    updateJob(config, {
      status: "merging",
      message: "正在合并分析结果...",
      percent: 75,
      stage: "merging",
    });

    const merged = await hierarchicalMerge(llm, state.extractions);
    const { job } = getConfigurable(config);
    job.merged = merged;

    return { merged };
  };

  const synthesizeNode = async (
    state: WorldviewGraphState,
    config?: LangGraphRunnableConfig,
  ): Promise<Partial<WorldviewGraphState>> => {
    updateJob(config, {
      status: "synthesizing",
      message: "正在生成分析报告...",
      percent: 90,
      stage: "synthesizing",
    });

    const merged = state.merged;
    if (!merged) throw new Error("合并结果为空，无法生成报告");

    const user = synthesizeUser({
      title: state.title,
      totalChars: getConfigurable(config).job.totalChars,
      chunkCount: state.chunks.length,
      mergedJson: JSON.stringify(merged, null, 2),
    });
    const markdown = await llm.chat(SYNTHESIZE_SYSTEM, user, { temperature: 0.3 });

    return { markdown };
  };

  return { chunkNode, extractNode, mergeNode, synthesizeNode };
}
