export type JobStatus =
  | "pending"
  | "chunking"
  | "extracting"
  | "merging"
  | "synthesizing"
  | "completed"
  | "failed";

export interface TextChunk {
  index: number;
  title: string;
  startChar: number;
  endChar: number;
  text: string;
  charCount: number;
}

export interface EntityItem {
  name: string;
  category: string;
  description: string;
  firstMentionChunk?: number | null;
  aliases: string[];
}

export interface PlotEvent {
  summary: string;
  type: string;
  characters: string[];
}

export interface CharacterItem {
  name: string;
  aliases: string[];
  role: string;
  description: string;
  relationships: string[];
  abilities: string[];
  development: string[];
  firstMentionChunk?: number | null;
}

export interface ItemEntry {
  name: string;
  aliases: string[];
  category: string;
  description: string;
  owner: string;
  abilities: string[];
  significance: string;
  firstMentionChunk?: number | null;
}

export interface PlotArc {
  name: string;
  summary: string;
  events: string[];
}

export interface MainPlot {
  overview: string;
  arcs: PlotArc[];
  keyTurningPoints: string[];
  conflicts: string[];
  foreshadowing: string[];
  unresolvedThreads: string[];
  timeline: string[];
}

export interface ChunkExtraction {
  chunkIndex: number;
  chunkTitle: string;
  plotEvents: PlotEvent[];
  geography: string[];
  factions: string[];
  powerSystem: string[];
  racesSpecies: string[];
  historyEvents: string[];
  rulesLaws: string[];
  technologyMagic: string[];
  cultureReligion: string[];
  keyEntities: EntityItem[];
  characters: CharacterItem[];
  items: ItemEntry[];
  timelineNotes: string[];
  openQuestions: string[];
}

export interface MergedWorldview {
  mainPlot: MainPlot;
  geography: string[];
  factions: string[];
  powerSystem: string[];
  racesSpecies: string[];
  historyTimeline: string[];
  rulesLaws: string[];
  technologyMagic: string[];
  cultureReligion: string[];
  keyEntities: EntityItem[];
  characters: CharacterItem[];
  items: ItemEntry[];
  contradictions: string[];
  confidenceNotes: string[];
}

export interface WorldviewReport {
  title: string;
  summary: string;
  structured: MergedWorldview;
  fullMarkdown: string;
  metadata: Record<string, unknown>;
}

export interface JobProgress {
  status: JobStatus;
  totalChunks: number;
  processedChunks: number;
  currentStage: string;
  message: string;
  percent: number;
}

export interface AnalysisJob {
  id: string;
  filename: string;
  totalChars: number;
  createdAt: string;
  updatedAt: string;
  progress: JobProgress;
  chunks: TextChunk[];
  extractions: ChunkExtraction[];
  merged: MergedWorldview | null;
  report: WorldviewReport | null;
  error: string | null;
}

export type ProgressCallback = (job: AnalysisJob) => void;
