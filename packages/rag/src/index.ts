// Magic Writer · RAG
//
// 当前版本：提供稳定的接口与一套最小可用的内存向量检索实现（hash-bag embedding）。
// 后续按设计文档替换为 bge-m3（本地）+ LanceDB 持久化，不影响上层调用。

export interface Embedder {
  readonly dim: number
  embed(text: string): Promise<Float32Array>
  embedBatch(texts: string[]): Promise<Float32Array[]>
}

export interface VectorRecord {
  id: string
  projectId: string
  chapterId?: string
  text: string
  vector: Float32Array
  meta?: Record<string, unknown>
}

export interface SearchHit {
  id: string
  score: number
  text: string
  chapterId?: string
  meta?: Record<string, unknown>
}

// ---------- 占位 Embedder：hash-bag（稳定、无依赖） ----------

export class HashBagEmbedder implements Embedder {
  readonly dim = 256

  async embed(text: string): Promise<Float32Array> {
    const v = new Float32Array(this.dim)
    const tokens = tokenize(text)
    for (const tok of tokens) {
      const h = hash32(tok) % this.dim
      v[h] += 1
    }
    normalize(v)
    return v
  }

  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    return Promise.all(texts.map((t) => this.embed(t)))
  }
}

// ---------- 简版内存向量库 ----------

export class InMemoryVectorStore {
  private records: VectorRecord[] = []

  constructor(private readonly embedder: Embedder = new HashBagEmbedder()) {}

  async upsert(
    items: Array<Omit<VectorRecord, 'vector'> & { vector?: Float32Array }>
  ): Promise<void> {
    for (const item of items) {
      const vector = item.vector ?? (await this.embedder.embed(item.text))
      const idx = this.records.findIndex((r) => r.id === item.id)
      const rec: VectorRecord = { ...item, vector }
      if (idx >= 0) this.records[idx] = rec
      else this.records.push(rec)
    }
  }

  async search(query: string, topK = 5, projectId?: string): Promise<SearchHit[]> {
    const q = await this.embedder.embed(query)
    const pool = projectId
      ? this.records.filter((r) => r.projectId === projectId)
      : this.records
    return pool
      .map((r) => ({
        id: r.id,
        score: cosine(q, r.vector),
        text: r.text,
        chapterId: r.chapterId,
        meta: r.meta
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
  }

  clear(projectId?: string): void {
    this.records = projectId
      ? this.records.filter((r) => r.projectId !== projectId)
      : []
  }

  size(): number {
    return this.records.length
  }
}

// ---------- 工具函数 ----------

function tokenize(text: string): string[] {
  // 中文按字切，英文数字按单词切
  const out: string[] = []
  const re = /[\u4e00-\u9fff]|[a-zA-Z0-9]+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) out.push(m[0].toLowerCase())
  return out
}

function hash32(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function normalize(v: Float32Array): void {
  let sum = 0
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i]
  const n = Math.sqrt(sum) || 1
  for (let i = 0; i < v.length; i++) v[i] /= n
}

function cosine(a: Float32Array, b: Float32Array): number {
  let s = 0
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) s += a[i] * b[i]
  return s
}
