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
}

export interface PropData {
  category?: string
  description?: string
  owner?: string
  abilities?: string[]
}

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
