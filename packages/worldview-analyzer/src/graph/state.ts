import { Annotation } from "@langchain/langgraph";
import type { AnalysisJob, ChunkExtraction, MergedWorldview, TextChunk } from "../types";

export const WorldviewStateAnnotation = Annotation.Root({
  text: Annotation<string>,
  title: Annotation<string>,
  chunks: Annotation<TextChunk[]>,
  extractions: Annotation<ChunkExtraction[]>,
  merged: Annotation<MergedWorldview | null>,
  markdown: Annotation<string>,
});

export type WorldviewGraphState = typeof WorldviewStateAnnotation.State;

export interface WorldviewGraphConfigurable {
  job: AnalysisJob;
  onProgress?: (job: AnalysisJob) => void;
}
