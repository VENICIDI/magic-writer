/**
 * Magic Writer · RAG Engine（主进程侧单例）
 *
 * 职责：
 * - 保存章节时自动切 chunk + embed + upsert
 * - 续写时检索相关前文片段
 */
import { InMemoryVectorStore, HashBagEmbedder, type SearchHit } from '@magic-writer/rag'

let store: InMemoryVectorStore | null = null

export function getRAGEngine(): InMemoryVectorStore {
  if (!store) {
    store = new InMemoryVectorStore(new HashBagEmbedder())
  }
  return store
}

/**
 * 对章节内容切 chunk 并索引到向量库
 */
export async function indexChapter(
  projectId: string,
  chapterId: string,
  content: string
): Promise<void> {
  const engine = getRAGEngine()
  const chunks = chunkText(content, chapterId)

  if (chunks.length === 0) return

  await engine.upsert(
    chunks.map((chunk) => ({
      id: chunk.id,
      projectId,
      chapterId,
      text: chunk.text
    }))
  )
}

/**
 * 检索相关前文
 */
export async function searchRAG(
  query: string,
  topK: number,
  projectId: string
): Promise<SearchHit[]> {
  const engine = getRAGEngine()
  return engine.search(query, topK, projectId)
}

// ============================================================
// Chunker：滑动窗口切片
// ============================================================

interface ChunkResult {
  id: string
  text: string
  chapterId: string
  offset: number
}

function chunkText(text: string, chapterId: string): ChunkResult[] {
  const CHUNK_SIZE = 500 // 每 chunk 约 500 字
  const OVERLAP = 100 // 重叠 100 字

  if (!text || text.trim().length < 50) return []

  const chunks: ChunkResult[] = []
  let offset = 0

  while (offset < text.length) {
    const end = Math.min(offset + CHUNK_SIZE, text.length)
    const slice = text.slice(offset, end)

    if (slice.trim().length > 20) {
      chunks.push({
        id: `${chapterId}-${offset}`,
        text: slice,
        chapterId,
        offset
      })
    }

    offset += CHUNK_SIZE - OVERLAP
    if (offset >= text.length) break
  }

  return chunks
}
