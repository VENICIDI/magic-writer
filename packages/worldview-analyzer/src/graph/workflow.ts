import { END, START, StateGraph } from "@langchain/langgraph";
import type { LLMClient } from "../llm";
import { createGraphNodes } from "./nodes";
import { WorldviewStateAnnotation } from "./state";

export function createWorldviewGraph(llm: LLMClient) {
  const { chunkNode, extractNode, mergeNode, synthesizeNode } = createGraphNodes(llm);

  return new StateGraph(WorldviewStateAnnotation)
    .addNode("chunk", chunkNode)
    .addNode("extract", extractNode)
    .addNode("merge", mergeNode)
    .addNode("synthesize", synthesizeNode)
    .addEdge(START, "chunk")
    .addEdge("chunk", "extract")
    .addEdge("extract", "merge")
    .addEdge("merge", "synthesize")
    .addEdge("synthesize", END)
    .compile();
}

export type WorldviewGraph = ReturnType<typeof createWorldviewGraph>;
