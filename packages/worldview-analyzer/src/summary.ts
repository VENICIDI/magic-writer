import type {
  AnalysisJob,
  CharacterItem,
  ChunkExtraction,
  EntityItem,
  ItemEntry,
  MainPlot,
  MergedWorldview,
  PlotEvent,
} from "./types";
import { emptyMainPlot } from "./graph/transform";

export interface ExtractionStats {
  completedChunks: number;
  totalChunks: number;
  plotEvents: number;
  characters: string[];
  items: string[];
  geography: number;
  factions: number;
  powerSystem: number;
  racesSpecies: number;
  historyTimeline: number;
  rulesLaws: number;
  technologyMagic: number;
  cultureReligion: number;
  keyEntities: number;
  openQuestions: number;
  contradictions: number;
  recentChunks: Array<{
    index: number;
    title: string;
    plotEvents: number;
    characters: string[];
    items: string[];
  }>;
}

export interface PlotEventEntry extends PlotEvent {
  chunkIndex: number;
  chunkTitle: string;
}

export interface WorldviewData {
  mainPlot: MainPlot;
  plotEvents: PlotEventEntry[];
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
  openQuestions: string[];
  source: "merged" | "partial";
}

function doneExtractions(extractions: AnalysisJob["extractions"]): ChunkExtraction[] {
  return extractions.filter((e): e is ChunkExtraction => e != null);
}

function aggregateStringField(
  job: AnalysisJob,
  chunkField: keyof Pick<
    ChunkExtraction,
    | "geography"
    | "factions"
    | "powerSystem"
    | "racesSpecies"
    | "historyEvents"
    | "rulesLaws"
    | "technologyMagic"
    | "cultureReligion"
    | "timelineNotes"
    | "openQuestions"
  >,
  mergedField?: keyof Pick<
    MergedWorldview,
    | "geography"
    | "factions"
    | "powerSystem"
    | "racesSpecies"
    | "historyTimeline"
    | "rulesLaws"
    | "technologyMagic"
    | "cultureReligion"
  >,
): string[] {
  if (job.merged && mergedField) {
    const v = job.merged[mergedField];
    return [...v];
  }

  const set = new Set<string>();
  for (const ext of doneExtractions(job.extractions)) {
    for (const s of ext[chunkField] as string[]) {
      if (s) set.add(s);
    }
  }
  return [...set];
}

function mergeEntities(a: EntityItem, b: EntityItem): EntityItem {
  return {
    name: a.name,
    category: a.category || b.category,
    description: a.description.length >= b.description.length ? a.description : b.description,
    aliases: mergeStringLists(a.aliases, b.aliases),
    firstMentionChunk: a.firstMentionChunk ?? b.firstMentionChunk ?? null,
  };
}

export function listKeyEntities(job: AnalysisJob): EntityItem[] {
  if (job.merged?.keyEntities.length) {
    return [...job.merged.keyEntities].sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  }

  const map = new Map<string, EntityItem>();
  for (const ext of doneExtractions(job.extractions)) {
    for (const e of ext.keyEntities) {
      if (!e.name) continue;
      const existing = map.get(e.name);
      map.set(e.name, existing ? mergeEntities(existing, e) : { ...e });
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
}

function getMainPlot(job: AnalysisJob): MainPlot {
  if (job.merged?.mainPlot) return job.merged.mainPlot;
  const timeline = aggregateStringField(job, "timelineNotes");
  return { ...emptyMainPlot(), timeline };
}

function listPlotEvents(job: AnalysisJob): PlotEventEntry[] {
  const events: PlotEventEntry[] = [];
  for (const ext of doneExtractions(job.extractions)) {
    for (const e of ext.plotEvents) {
      events.push({ ...e, chunkIndex: ext.chunkIndex, chunkTitle: ext.chunkTitle });
    }
  }
  return events;
}

export function getWorldviewData(job: AnalysisJob): WorldviewData {
  const merged = job.merged;
  return {
    mainPlot: getMainPlot(job),
    plotEvents: listPlotEvents(job),
    geography: aggregateStringField(job, "geography", "geography"),
    factions: aggregateStringField(job, "factions", "factions"),
    powerSystem: aggregateStringField(job, "powerSystem", "powerSystem"),
    racesSpecies: aggregateStringField(job, "racesSpecies", "racesSpecies"),
    historyTimeline: aggregateStringField(job, "historyEvents", "historyTimeline"),
    rulesLaws: aggregateStringField(job, "rulesLaws", "rulesLaws"),
    technologyMagic: aggregateStringField(job, "technologyMagic", "technologyMagic"),
    cultureReligion: aggregateStringField(job, "cultureReligion", "cultureReligion"),
    keyEntities: listKeyEntities(job),
    characters: listCharacters(job),
    items: listItems(job),
    contradictions: merged?.contradictions ?? [],
    confidenceNotes: merged?.confidenceNotes ?? [],
    openQuestions: aggregateStringField(job, "openQuestions"),
    source: merged ? "merged" : "partial",
  };
}

export function summarizeExtractions(job: AnalysisJob): ExtractionStats {
  const w = getWorldviewData(job);
  const done = doneExtractions(job.extractions);

  const recent = done.slice(-5).map((e) => ({
    index: e.chunkIndex,
    title: e.chunkTitle,
    plotEvents: e.plotEvents.length,
    characters: e.characters.map((c) => c.name).filter(Boolean),
    items: e.items.map((i) => i.name).filter(Boolean),
  }));

  const plotEvents =
    w.mainPlot.timeline.length ||
    w.plotEvents.length ||
    w.mainPlot.arcs.reduce((n, a) => n + a.events.length, 0);

  return {
    completedChunks: done.length,
    totalChunks: job.progress.totalChunks,
    plotEvents,
    characters: w.characters.map((c) => c.name),
    items: w.items.map((i) => i.name),
    geography: w.geography.length,
    factions: w.factions.length,
    powerSystem: w.powerSystem.length,
    racesSpecies: w.racesSpecies.length,
    historyTimeline: w.historyTimeline.length,
    rulesLaws: w.rulesLaws.length,
    technologyMagic: w.technologyMagic.length,
    cultureReligion: w.cultureReligion.length,
    keyEntities: w.keyEntities.length,
    openQuestions: w.openQuestions.length,
    contradictions: w.contradictions.length,
    recentChunks: recent,
  };
}

function mergeStringLists(...lists: string[][]): string[] {
  return [...new Set(lists.flat().filter(Boolean))];
}

function mergeCharacters(a: CharacterItem, b: CharacterItem): CharacterItem {
  return {
    name: a.name,
    aliases: mergeStringLists(a.aliases, b.aliases),
    role: a.role || b.role,
    description: a.description.length >= b.description.length ? a.description : b.description,
    relationships: mergeStringLists(a.relationships, b.relationships),
    abilities: mergeStringLists(a.abilities, b.abilities),
    development: mergeStringLists(a.development, b.development),
    firstMentionChunk: a.firstMentionChunk ?? b.firstMentionChunk ?? null,
  };
}

function mergeItems(a: ItemEntry, b: ItemEntry): ItemEntry {
  return {
    name: a.name,
    aliases: mergeStringLists(a.aliases, b.aliases),
    category: a.category || b.category,
    description: a.description.length >= b.description.length ? a.description : b.description,
    owner: a.owner || b.owner,
    abilities: mergeStringLists(a.abilities, b.abilities),
    significance: a.significance.length >= b.significance.length ? a.significance : b.significance,
    firstMentionChunk: a.firstMentionChunk ?? b.firstMentionChunk ?? null,
  };
}

export function listCharacters(job: AnalysisJob): CharacterItem[] {
  if (job.merged?.characters.length) {
    return [...job.merged.characters].sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  }

  const map = new Map<string, CharacterItem>();
  for (const ext of doneExtractions(job.extractions)) {
    for (const c of ext.characters) {
      if (!c.name) continue;
      const existing = map.get(c.name);
      map.set(c.name, existing ? mergeCharacters(existing, c) : { ...c });
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
}

export function listItems(job: AnalysisJob): ItemEntry[] {
  if (job.merged?.items.length) {
    return [...job.merged.items].sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  }

  const map = new Map<string, ItemEntry>();
  for (const ext of doneExtractions(job.extractions)) {
    for (const i of ext.items) {
      if (!i.name) continue;
      const existing = map.get(i.name);
      map.set(i.name, existing ? mergeItems(existing, i) : { ...i });
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
}

export function formatExtractionSummary(job: AnalysisJob): string {
  const s = summarizeExtractions(job);
  const p = job.progress;
  const lines = [
    `任务: ${job.id}`,
    `小说: ${job.report?.title ?? job.filename}`,
    `进度: ${p.percent.toFixed(1)}% | ${p.status} | ${p.message}`,
    `已提取: ${s.completedChunks}/${s.totalChunks} 块`,
    "",
    "【累计统计】",
    `  主线情节: ${s.plotEvents} 条`,
    `  角色: ${s.characters.length} 位`,
    `  物品: ${s.items.length} 件`,
    `  地理线索: ${s.geography} 条`,
    `  势力线索: ${s.factions} 条`,
  ];

  if (s.characters.length) {
    const preview = s.characters.slice(0, 20).join("、");
    const more = s.characters.length > 20 ? ` …等共 ${s.characters.length} 位` : "";
    lines.push("", `【已识别角色】${preview}${more}`);
  }

  if (s.items.length) {
    const preview = s.items.slice(0, 20).join("、");
    const more = s.items.length > 20 ? ` …等共 ${s.items.length} 件` : "";
    lines.push("", `【已识别物品】${preview}${more}`);
  }

  if (s.recentChunks.length) {
    lines.push("", "【最近完成的块】");
    for (const c of s.recentChunks) {
      lines.push(
        `  #${c.index + 1} ${c.title} — 情节 ${c.plotEvents} 条, 角色 ${c.characters.join("、") || "无"}, 物品 ${c.items.join("、") || "无"}`,
      );
    }
  }

  if (job.progress.status === "completed" && job.report) {
    lines.push("", `【最终报告】${job.report.summary}`);
    lines.push(`  Markdown: output/${job.report.title}_分析报告.md`);
  }

  return lines.join("\n");
}
