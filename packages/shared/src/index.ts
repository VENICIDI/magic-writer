// ============================================================
// Magic Writer · 共享类型与协议
// ============================================================

// ---------- 领域模型 ----------

export interface Project {
  id: string
  title: string
  genre: string
  logline: string
  rootPath: string
  createdAt: number
  updatedAt: number
}

export interface Volume {
  id: string
  projectId: string
  title: string
  order: number
}

export interface Chapter {
  id: string
  projectId: string
  volumeId: string
  title: string
  filePath: string
  outline: string
  wordCount: number
  status: 'draft' | 'done' | 'published'
  order: number
  updatedAt: number
}

export interface Character {
  id: string
  projectId: string
  name: string
  aliases: string[]
  age?: number
  appearance: string
  personality: string
  abilities: string[]
  relations: { targetId: string; type: string; note: string }[]
  firstAppearChapterId?: string
  lockedFields: string[]
}

export interface Foreshadowing {
  id: string
  projectId: string
  description: string
  plantedAt: { chapterId: string; offset: number }
  resolvedAt?: { chapterId: string; offset: number }
  status: 'pending' | 'resolved' | 'abandoned'
}

// ---------- 统一实体模型 ----------
// 底层用单一多态实体表统一管理人物/事件/地点/道具/伏笔等。
// 章节作为可被关系引用的特殊类型，仍保留其专用表与正文文件存储。

export type EntityType =
  | 'character'
  | 'event'
  | 'location'
  | 'prop'
  | 'foreshadowing'
  | 'chapter'
  // 线索/故事线：以统一实体形式存储，成员通过 entity_relations(type=STORYLINE_MEMBER_RELATION) 串联。
  // 它不是图谱中的普通节点，而是用于高亮/过滤的「覆盖层」，故在按类型列实体的面板中需排除。
  | 'storyline'

export interface Entity<T extends Record<string, unknown> = Record<string, unknown>> {
  id: string
  projectId: string
  type: EntityType
  name: string
  summary: string
  data: T
  tags: string[]
  order: number
  createdAt: number
  updatedAt: number
}

export interface EntityRelation {
  id: string
  projectId: string
  fromId: string
  fromType: EntityType
  toId: string
  toType: EntityType
  type: string
  note: string
  createdAt: number
}

// 类型化的 data 载荷（存于 Entity.data）
export interface EventData {
  time?: string
  location?: string
  participants?: string[]
  chapterId?: string
  detail?: string
}

export interface LocationData {
  region?: string
  description?: string
  significance?: string
  // 在「地图」底图上的归一化坐标（0~1，相对底图宽高），缺省表示尚未放置到地图上。
  // 用归一化比例而非像素，缩放/窗口变化时图钉位置不会错位。
  mapX?: number
  mapY?: number
}

export interface PropData {
  category?: string
  description?: string
  owner?: string
  abilities?: string[]
}

export interface StorylineData {
  // 线索在图谱中的高亮配色（hex），用于「全部线索」总览时区分不同故事线。
  color?: string
}

/**
 * 线索成员关系的固定 type 值：from=storyline 实体，to=成员实体。
 * 该类型的关系仅用于线索归属，不应作为知识图谱的普通边渲染。
 */
export const STORYLINE_MEMBER_RELATION = 'includes'

/**
 * 知识图谱中用于「类型区分」的实体类型顺序（不含线索与章节由调用方决定是否纳入）。
 * 章节作为可被引用的节点保留，线索始终排除在普通节点之外。
 */
export const GRAPH_ENTITY_TYPES: EntityType[] = [
  'character',
  'event',
  'location',
  'prop',
  'foreshadowing',
  'chapter'
]

/** 线索高亮的默认配色池（暖中性 + 冷调，避免与信号绿冲突）。 */
export const STORYLINE_COLOR_POOL = [
  '#4cb3d4',
  '#c98fb0',
  '#9d8ec9',
  '#d4a24c',
  '#7fb37f',
  '#b8b3b0'
]

export type AgentType = 'outline' | 'writer' | 'polish' | 'review' | 'world'

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  ts: number
}

export interface AgentSession {
  id: string
  projectId: string
  type: AgentType
  messages: AgentMessage[]
}

// ---------- LLM ----------

export type LLMProvider = 'openai' | 'anthropic' | 'deepseek' | 'ollama' | 'mock'

export interface LLMConfig {
  provider: LLMProvider
  model: string
  apiKey?: string
  baseURL?: string
  temperature?: number
  maxTokens?: number
}

export interface LLMChatRequest {
  messages: AgentMessage[]
  config?: Partial<LLMConfig>
  stream?: boolean
}

export interface LLMStreamChunk {
  requestId: string
  delta: string
  done: boolean
  error?: string
}

// ---------- IPC 契约 ----------
// 规则：channel 名使用 `domain:action`，renderer 经由 preload 暴露的 `window.api` 调用。

export const IPC = {
  // 项目
  ProjectList: 'project:list',
  ProjectCreate: 'project:create',
  ProjectOpen: 'project:open',
  ProjectGet: 'project:get',

  // 章节
  ChapterList: 'chapter:list',
  ChapterGet: 'chapter:get',
  ChapterSave: 'chapter:save',
  ChapterCreate: 'chapter:create',

  // 统一实体
  EntityList: 'entity:list',
  EntityGet: 'entity:get',
  EntityUpsert: 'entity:upsert',
  EntityDelete: 'entity:delete',
  EntityGenerate: 'entity:generate',

  // 统一关系
  RelationList: 'relation:list',
  RelationUpsert: 'relation:upsert',
  RelationDelete: 'relation:delete',

  // Agent / LLM
  AgentRun: 'agent:run',
  AgentStop: 'agent:stop', // renderer -> main，中断指定 requestId 的生成
  AgentStreamChunk: 'agent:stream-chunk', // main -> renderer

  // 系统
  AppVersion: 'app:version'
} as const

export type IPCChannel = (typeof IPC)[keyof typeof IPC]

// ---------- IPC 请求/响应类型 ----------

export interface ProjectListResponse {
  projects: Project[]
}

export interface ProjectCreateRequest {
  title: string
  genre: string
  logline: string
}

export interface ChapterListRequest {
  projectId: string
}

export interface ChapterSaveRequest {
  chapterId: string
  content: string
}

export interface AgentRunRequest {
  requestId: string
  projectId: string
  agentType: AgentType
  input: string
  selection?: string
  chapterId?: string
}

export interface AgentRunResponse {
  requestId: string
  ok: boolean
  error?: string
}

// ---------- 统一实体 IPC 请求 ----------

export interface EntityListRequest {
  projectId: string
  type?: EntityType
}

export interface EntityDeleteRequest {
  id: string
}

// AI 随机生成实体（角色/道具/地点/事件/伏笔）
export interface EntityGenerateRequest {
  projectId: string
  type: EntityType
  // 可选：用户的额外要求/方向（如「一个反派老者」）
  hint?: string
}

export interface EntityGenerateResponse {
  ok: boolean
  entity?: Entity
  error?: string
}

export interface RelationListRequest {
  projectId: string
  entityId?: string
}

export interface RelationDeleteRequest {
  id: string
}

// ---------- 通用工具 ----------

/**
 * 中文字数统计：中文按字、英文按词计。全工程统一使用此实现，
 * 避免 store / 状态栏 / 存储层各写一份导致口径不一致。
 */
export function countWords(text: string): number {
  const zh = (text.match(/[\u4e00-\u9fff]/g) ?? []).length
  const en = (text.match(/[a-zA-Z]+/g) ?? []).length
  return zh + en
}

/**
 * 将 LLM 原始报错转为中文友好提示，并保留原始信息在次要位置，
 * 方便用户排查（如鉴权失败引导去设置填 Key）。
 */
export function friendlyLLMError(raw: string): string {
  const msg = raw || '未知错误'
  let hint: string | null = null

  if (/HTTP 401|HTTP 403|invalid api key|unauthorized/i.test(msg)) {
    hint = 'AI 接口鉴权失败：请到「设置」检查 API Key 是否正确、是否已过期。'
  } else if (/HTTP 404/.test(msg)) {
    hint = '接口地址或模型不存在（404）：请检查「设置」里的 Base URL 与模型名称。'
  } else if (/HTTP 429|rate limit|quota/i.test(msg)) {
    hint = '请求过于频繁或额度不足（429）：请稍后再试，或检查账户额度。'
  } else if (/HTTP 5\d\d/.test(msg)) {
    hint = 'AI 服务暂时不可用（5xx）：请稍后重试。'
  } else if (/fetch failed|failed to fetch|enotfound|econnrefused|etimedout|network|socket/i.test(msg)) {
    hint = '网络连接失败：请检查网络，以及「设置」里的 Base URL 是否可访问。'
  }

  if (!hint) return msg
  return `${hint}\n（原始信息：${msg}）`
}
