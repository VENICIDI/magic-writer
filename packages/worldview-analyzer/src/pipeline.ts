import { v4 as uuidv4 } from "uuid";
import { createWorldviewGraph } from "./graph/workflow";
import { buildSummary, emptyMerged } from "./graph/transform";
import { LLMClient } from "./llm";
import { JobStore } from "./store";
import type { AnalysisJob, ProgressCallback } from "./types";

export class WorldviewPipeline {
  private store: JobStore;
  private llm: LLMClient | null;
  private graph: ReturnType<typeof createWorldviewGraph> | null;

  constructor(store?: JobStore, llm?: LLMClient) {
    this.store = store ?? new JobStore();
    this.llm = llm ?? null;
    this.graph = null;
  }

  private getLlm(): LLMClient {
    if (!this.llm) this.llm = new LLMClient();
    return this.llm;
  }

  private getGraph() {
    if (!this.graph) this.graph = createWorldviewGraph(this.getLlm());
    return this.graph;
  }

  createJob(text: string, filename = "inline.txt", title = ""): AnalysisJob {
    const now = new Date().toISOString();
    const job: AnalysisJob = {
      id: uuidv4(),
      filename,
      totalChars: text.length,
      createdAt: now,
      updatedAt: now,
      progress: {
        status: "pending",
        totalChunks: 0,
        processedChunks: 0,
        currentStage: "",
        message: "任务已创建",
        percent: 0,
      },
      chunks: [],
      extractions: [],
      merged: null,
      report: {
        title: title || filename,
        summary: "",
        structured: emptyMerged(),
        fullMarkdown: "",
        metadata: { sourceChars: text.length },
      },
      error: null,
    };
    this.store.save(job);
    return job;
  }

  private save(job: AnalysisJob, onProgress?: ProgressCallback): void {
    this.store.save(job);
    onProgress?.(job);
  }

  async run(job: AnalysisJob, text: string, title = "", onProgress?: ProgressCallback): Promise<AnalysisJob> {
    const graph = this.getGraph();
    const reportTitle = title || job.report?.title || job.filename;

    try {
      const result = await graph.invoke(
        {
          text,
          title: reportTitle,
          chunks: [],
          extractions: [],
          merged: null,
          markdown: "",
        },
        {
          configurable: {
            job,
            onProgress: (j: AnalysisJob) => {
              this.save(j, onProgress);
            },
          },
        },
      );

      const merged = result.merged;
      if (!merged) throw new Error("分析流程未产生合并结果");

      job.report = {
        title: reportTitle,
        summary: buildSummary(merged),
        structured: merged,
        fullMarkdown: result.markdown,
        metadata: {
          totalChars: job.totalChars,
          chunkCount: result.chunks.length,
          plotEventCount: merged.mainPlot.timeline.length,
          characterCount: merged.characters.length,
          itemCount: merged.items.length,
          entityCount: merged.keyEntities.length,
        },
      };

      job.progress.status = "completed";
      job.progress.message = "分析完成";
      job.progress.percent = 100;
      this.save(job, onProgress);
      return job;
    } catch (err) {
      console.error(`分析任务失败: ${job.id}`, err);
      job.error = String(err);
      job.progress.status = "failed";
      job.progress.message = `失败: ${String(err)}`;
      this.save(job, onProgress);
      throw err;
    }
  }
}
