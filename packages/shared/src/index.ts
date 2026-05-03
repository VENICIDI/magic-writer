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
