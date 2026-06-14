import type {
  CharacterItem,
  ChunkExtraction,
  EntityItem,
  ItemEntry,
  MainPlot,
  MergedWorldview,
  PlotEvent,
} from "../types";

export function emptyMainPlot(): MainPlot {
  return {
    overview: "",
    arcs: [],
    keyTurningPoints: [],
    conflicts: [],
    foreshadowing: [],
    unresolvedThreads: [],
    timeline: [],
  };
}

export function emptyMerged(): MergedWorldview {
  return {
    mainPlot: emptyMainPlot(),
    geography: [],
    factions: [],
    powerSystem: [],
    racesSpecies: [],
    historyTimeline: [],
    rulesLaws: [],
    technologyMagic: [],
    cultureReligion: [],
    keyEntities: [],
    characters: [],
    items: [],
    contradictions: [],
    confidenceNotes: [],
  };
}

function toEntityItem(e: Partial<EntityItem>): EntityItem {
  return {
    name: e.name ?? "",
    category: e.category ?? "",
    description: e.description ?? "",
    aliases: e.aliases ?? [],
    firstMentionChunk: e.firstMentionChunk ?? null,
  };
}

function toPlotEvent(e: Partial<PlotEvent>): PlotEvent {
  return {
    summary: e.summary ?? "",
    type: e.type ?? "",
    characters: e.characters ?? [],
  };
}

function toCharacterItem(e: Partial<CharacterItem>): CharacterItem {
  return {
    name: e.name ?? "",
    aliases: e.aliases ?? [],
    role: e.role ?? "",
    description: e.description ?? "",
    relationships: e.relationships ?? [],
    abilities: e.abilities ?? [],
    development: e.development ?? [],
    firstMentionChunk: e.firstMentionChunk ?? null,
  };
}

function toItemEntry(e: Partial<ItemEntry>): ItemEntry {
  return {
    name: e.name ?? "",
    aliases: e.aliases ?? [],
    category: e.category ?? "",
    description: e.description ?? "",
    owner: e.owner ?? "",
    abilities: e.abilities ?? [],
    significance: e.significance ?? "",
    firstMentionChunk: e.firstMentionChunk ?? null,
  };
}

export function toMainPlot(data: Partial<MainPlot> | undefined): MainPlot {
  const d = data ?? {};
  return {
    overview: d.overview ?? "",
    arcs: (d.arcs ?? []).map((a) => ({
      name: a.name ?? "",
      summary: a.summary ?? "",
      events: a.events ?? [],
    })),
    keyTurningPoints: d.keyTurningPoints ?? [],
    conflicts: d.conflicts ?? [],
    foreshadowing: d.foreshadowing ?? [],
    unresolvedThreads: d.unresolvedThreads ?? [],
    timeline: d.timeline ?? [],
  };
}

export function toExtraction(data: unknown): ChunkExtraction {
  const d = (data ?? {}) as Partial<ChunkExtraction>;
  return {
    chunkIndex: d.chunkIndex ?? 0,
    chunkTitle: d.chunkTitle ?? "",
    plotEvents: (d.plotEvents ?? []).map(toPlotEvent),
    geography: d.geography ?? [],
    factions: d.factions ?? [],
    powerSystem: d.powerSystem ?? [],
    racesSpecies: d.racesSpecies ?? [],
    historyEvents: d.historyEvents ?? [],
    rulesLaws: d.rulesLaws ?? [],
    technologyMagic: d.technologyMagic ?? [],
    cultureReligion: d.cultureReligion ?? [],
    keyEntities: (d.keyEntities ?? []).map(toEntityItem),
    characters: (d.characters ?? []).map(toCharacterItem),
    items: (d.items ?? []).map(toItemEntry),
    timelineNotes: d.timelineNotes ?? [],
    openQuestions: d.openQuestions ?? [],
  };
}

export function toMergedWorldview(data: Partial<MergedWorldview>): MergedWorldview {
  return {
    mainPlot: toMainPlot(data.mainPlot),
    geography: data.geography ?? [],
    factions: data.factions ?? [],
    powerSystem: data.powerSystem ?? [],
    racesSpecies: data.racesSpecies ?? [],
    historyTimeline: data.historyTimeline ?? [],
    rulesLaws: data.rulesLaws ?? [],
    technologyMagic: data.technologyMagic ?? [],
    cultureReligion: data.cultureReligion ?? [],
    keyEntities: (data.keyEntities ?? []).map(toEntityItem),
    characters: (data.characters ?? []).map(toCharacterItem),
    items: (data.items ?? []).map(toItemEntry),
    contradictions: data.contradictions ?? [],
    confidenceNotes: data.confidenceNotes ?? [],
  };
}

export function buildSummary(merged: MergedWorldview): string {
  const parts: string[] = [];
  if (merged.mainPlot.timeline.length) parts.push(`主线事件 ${merged.mainPlot.timeline.length} 条`);
  if (merged.geography.length) parts.push(`地理要素 ${merged.geography.length} 项`);
  if (merged.factions.length) parts.push(`势力 ${merged.factions.length} 个`);
  if (merged.powerSystem.length) parts.push(`力量体系线索 ${merged.powerSystem.length} 条`);
  if (merged.characters.length) parts.push(`角色 ${merged.characters.length} 位`);
  if (merged.items.length) parts.push(`物品 ${merged.items.length} 件`);
  if (merged.keyEntities.length) parts.push(`地点/概念 ${merged.keyEntities.length} 个`);
  return parts.length ? parts.join("；") : "已完成分析";
}
