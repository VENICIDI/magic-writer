import { config } from "./config";
import type { TextChunk } from "./types";

const CHAPTER_PATTERNS: RegExp[] = [
  /^第[零一二三四五六七八九十百千万\d]+[章节回卷部篇集]\s*.*$/gm,
  /^Chapter\s+\d+.*$/gim,
  /^CHAPTER\s+\d+.*$/gm,
  /^【[^】]{1,20}】\s*$/gm,
  /^序章.*$/gm,
  /^楔子.*$/gm,
  /^尾声.*$/gm,
  /^终章.*$/gm,
];

function findChapterSplits(text: string): Array<[number, string]> {
  const matches: Array<[number, string]> = [];
  const seen = new Set<number>();

  for (const pattern of CHAPTER_PATTERNS) {
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
      if (!seen.has(m.index)) {
        seen.add(m.index);
        matches.push([m.index, m[0].trim()]);
      }
    }
  }

  matches.sort((a, b) => a[0] - b[0]);
  return matches;
}

function splitBySize(
  text: string,
  baseOffset: number,
  titlePrefix: string,
  target: number,
  overlap: number,
): TextChunk[] {
  if (text.length <= target) {
    return [
      {
        index: 0,
        title: titlePrefix,
        startChar: baseOffset,
        endChar: baseOffset + text.length,
        text,
        charCount: text.length,
      },
    ];
  }

  const chunks: TextChunk[] = [];
  let start = 0;
  let idx = 0;

  while (start < text.length) {
    let end = Math.min(start + target, text.length);

    if (end < text.length) {
      let boundary = text.lastIndexOf("\n\n", end);
      if (boundary < start + target / 2) {
        boundary = text.lastIndexOf("\n", end);
      }
      if (boundary !== -1 && boundary > start && boundary >= start + target / 2) {
        end = boundary;
      }
    }

    const chunkText = text.slice(start, end);
    const suffix = idx > 0 || end < text.length ? ` (part ${idx + 1})` : "";
    chunks.push({
      index: idx,
      title: `${titlePrefix}${suffix}`.trim(),
      startChar: baseOffset + start,
      endChar: baseOffset + end,
      text: chunkText,
      charCount: chunkText.length,
    });

    if (end >= text.length) break;

    start = Math.max(end - overlap, start + 1);
    idx += 1;
  }

  return chunks;
}

export function chunkNovel(
  text: string,
  targetChars = config.chunkTargetChars,
  overlapChars = config.chunkOverlapChars,
): TextChunk[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const splits = findChapterSplits(trimmed);

  if (splits.length < 2) {
    const raw = splitBySize(trimmed, 0, "全文", targetChars, overlapChars);
    return raw.map((c, i) => ({ ...c, index: i }));
  }

  const sections: Array<[string, number, number]> = [];
  for (let i = 0; i < splits.length; i++) {
    const [offset, title] = splits[i];
    const end = i + 1 < splits.length ? splits[i + 1][0] : trimmed.length;
    sections.push([title, offset, end]);
  }

  if (splits[0][0] > 0) {
    sections.unshift(["前言", 0, splits[0][0]]);
  }

  const allChunks: TextChunk[] = [];
  let globalIdx = 0;

  for (const [title, start, end] of sections) {
    const sectionText = trimmed.slice(start, end).trim();
    if (!sectionText) continue;

    const subChunks = splitBySize(sectionText, start, title, targetChars, overlapChars);
    for (const sc of subChunks) {
      allChunks.push({ ...sc, index: globalIdx });
      globalIdx += 1;
    }
  }

  return allChunks;
}
