# Magic Writer — 后端架构文档

> 版本：v1.0 · 更新日期：2026-05-03
> 语言：TypeScript 全栈（Node.js 运行时，Electron 主进程）
> 配套文档：[前端架构](./ARCHITECTURE-FRONTEND.md) · [PRD](./PRD.md) · [设计规范](./DESIGN-SYSTEM.md)

---

## 一、架构总览

Magic Writer 的"后端"是 Electron 的 **主进程 (Main Process)**，以 Node.js 运行，承担所有数据持久化、AI 调用、RAG 检索、进程管理职责。

```
┌──────────────────────────────────────────────────────────────────┐
│                     Electron Main Process                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                      IPC Layer                               │ │
│  │  ipcMain.handle(channel, handler)                            │ │
│  │  webContents.send(channel, event)   // push to renderer      │ │
│  └──────────────────────┬──────────────────────────────────────┘ │
│                          │                                        │
│  ┌───────────┬───────────┼───────────┬───────────┬────────────┐ │
│  │           │           │           │           │            │ │
│  │  Storage  │   Agent   │    LLM    │    RAG    │  Worker    │ │
│  │  Module   │ Orchestr. │  Gateway  │   Engine  │   Pool     │ │
│  │           │           │           │           │            │ │
│  └─────┬─────┴─────┬─────┴─────┬─────┴─────┬─────┴─────┬──────┘ │
│        │           │           │           │           │          │
│        ▼           ▼           ▼           ▼           ▼          │
│  ┌──────────┐┌──────────┐┌──────────┐┌──────────┐┌──────────┐  │
│  │ SQLite   ││ Prompt   ││ HTTP/SSE ││ LanceDB  ││ Worker   │  │
│  │ +FTS5    ││ Template ││ Stream   ││ (嵌入式) ││ Thread   │  │
│  │          ││          ││          ││          ││          │  │
│  │ .md 文件 ││ Router   ││ Provider ││ Embedder ││ (全书审校│  │
│  │          ││          ││ Adapter  ││          ││  批量Emb)│  │
│  └──────────┘└──────────┘└──────────┘└──────────┘└──────────┘  │
│                                                                    │
├──────────────────────────────────────────────────────────────────┤
│  packages/ (独立可测试的核心库)                                     │
│  ┌──────────────┬────────────────┬──────────────┬──────────────┐ │
│  │ @mw/shared   │ @mw/agent-core │ @mw/llm-gw   │ @mw/rag      │ │
│  │ 类型+契约    │ Agent 编排     │ LLM 适配     │ 向量检索     │ │
│  └──────────────┴────────────────┴──────────────┴──────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## 二、技术栈

| 层级 | 技术 | 版本 | 选型理由 |
|---|---|---|---|
| **运行时** | Node.js (Electron 内置) | 20.x+ | V8 引擎、丰富生态 |
| **语言** | TypeScript | 6.x | 端到端类型安全 |
| **构建** | electron-vite | 5.x | 主进程 bundle + tree-shake |
| **关系数据** | better-sqlite3 | latest | 同步 API、WAL 模式、< 1ms 写入 |
| **全文检索** | SQLite FTS5 | 内置 | 零依赖、中文分词扩展 |
| **向量存储** | LanceDB (嵌入式 Rust) | latest | 本地 100w 向量 P99 < 50ms |
| **Embedding** | bge-m3（本地）/ text-embedding-3（云） | - | 中文效果优 |
| **LLM 接入** | 自建 Gateway（OpenAI 兼容协议） | - | 多模型、降级、解耦 |
| **Worker** | Node.js worker_threads | 内置 | 重任务进程隔离 |
| **文件存储** | fs (Markdown) | 内置 | 章节正文按文件存储 |
| **包管理** | pnpm workspace | 9.x | monorepo 多包管理 |

---

## 三、核心模块详述

### 3.1 模块依赖图

```
                    @magic-writer/shared
                   (类型、IPC 契约、领域模型)
                          │
          ┌───────────────┼───────────────┐
          │               │               │
  @magic-writer/    @magic-writer/   @magic-writer/
   llm-gateway       agent-core          rag
          │               │               │
          │      ┌────────┼────────┐      │
          │      │        │        │      │
          └──────┤        │        ├──────┘
                 │        │        │
          apps/desktop/src/main/
          ├── ipc/        (IPC handler 注册)
          ├── storage/    (数据持久化)
          ├── agents/     (Agent 调用入口)
          └── llm/        (LLM 配置管理)
```

### 3.2 packages 职责划分

| 包名 | 路径 | 职责 | 依赖 |
|---|---|---|---|
| `@magic-writer/shared` | `packages/shared` | 领域类型、IPC Channel 常量、请求/响应类型 | 无 |
| `@magic-writer/llm-gateway` | `packages/llm-gateway` | LLM Provider 适配器、SSE 流式解析、多模型路由 | shared |
| `@magic-writer/agent-core` | `packages/agent-core` | Agent 编排、Prompt 模板、上下文组装、意图路由 | shared, llm-gateway |
| `@magic-writer/rag` | `packages/rag` | Embedder 接口、向量存储接口、内存实现 | shared |

---

## 四、存储架构

### 4.1 存储层演进

| 阶段 | 方案 | 状态 |
|---|---|---|
| M0 | JSON 文件 + fs | ✅ 当前占位 |
| M1 | better-sqlite3 + FTS5 | 🔲 计划中 |
| M2 | + LanceDB 向量持久化 | 🔲 计划中 |

### 4.2 M1 目标架构：SQLite + Markdown

```
用户数据目录 (userData/magic-writer-data/)
├── meta.db                     # SQLite 主数据库
│   ├── projects               # 项目表
│   ├── volumes                # 卷表
│   ├── chapters               # 章节元数据表
│   ├── characters             # 人物卡表
│   ├── foreshadowing          # 伏笔表
│   ├── agent_sessions         # Agent 会话表
│   ├── settings               # 用户设置 KV 表
│   └── chapters_fts           # FTS5 全文索引虚拟表
│
├── chapters/                   # 章节正文 Markdown 文件
│   ├── c1.md
│   ├── c2.md
│   └── ...
│
├── vectors.lance/              # LanceDB 向量数据（M2）
│
└── backups/                    # 自动备份快照
```

### 4.3 SQLite Schema 设计

```sql
-- 项目
CREATE TABLE projects (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  genre       TEXT NOT NULL DEFAULT '',
  logline     TEXT NOT NULL DEFAULT '',
  root_path   TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

-- 卷
CREATE TABLE volumes (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  "order"     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_volumes_project ON volumes(project_id);

-- 章节
CREATE TABLE chapters (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  volume_id   TEXT NOT NULL REFERENCES volumes(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  file_path   TEXT NOT NULL,
  outline     TEXT NOT NULL DEFAULT '',
  word_count  INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','done','published')),
  "order"     INTEGER NOT NULL DEFAULT 0,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX idx_chapters_project ON chapters(project_id);
CREATE INDEX idx_chapters_volume ON chapters(volume_id);

-- 人物卡
CREATE TABLE characters (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  aliases         TEXT NOT NULL DEFAULT '[]',     -- JSON array
  age             INTEGER,
  appearance      TEXT NOT NULL DEFAULT '',
  personality     TEXT NOT NULL DEFAULT '',
  abilities       TEXT NOT NULL DEFAULT '[]',     -- JSON array
  relations       TEXT NOT NULL DEFAULT '[]',     -- JSON array
  first_appear_chapter_id TEXT,
  locked_fields   TEXT NOT NULL DEFAULT '[]'      -- JSON array
);
CREATE INDEX idx_characters_project ON characters(project_id);

-- 伏笔
CREATE TABLE foreshadowing (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  planted_at  TEXT NOT NULL DEFAULT '{}',   -- JSON { chapterId, offset }
  resolved_at TEXT,                          -- JSON { chapterId, offset } | null
  status      TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','resolved','abandoned'))
);
CREATE INDEX idx_foreshadowing_project ON foreshadowing(project_id);

-- Agent 会话
CREATE TABLE agent_sessions (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK(type IN ('outline','writer','polish','review','world')),
  messages    TEXT NOT NULL DEFAULT '[]',   -- JSON array
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

-- 全文搜索（FTS5）
CREATE VIRTUAL TABLE chapters_fts USING fts5(
  chapter_id,
  content,
  tokenize='unicode61'
);

-- 用户设置 KV
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

### 4.4 Storage 模块接口

```typescript
// apps/desktop/src/main/storage/index.ts

export interface StorageModule {
  // 项目
  listProjects(): Project[]
  getProject(id: string): Project | null
  createProject(input: ProjectCreateRequest): Project
  updateProject(id: string, patch: Partial<Project>): Project | null
  deleteProject(id: string): void

  // 卷
  listVolumes(projectId: string): Volume[]
  createVolume(projectId: string, title: string): Volume

  // 章节
  listChapters(projectId: string): Chapter[]
  getChapterContent(chapterId: string): { chapter: Chapter; content: string } | null
  saveChapter(chapterId: string, content: string): Chapter | null
  createChapter(input: { projectId: string; volumeId: string; title: string }): Chapter

  // 世界观
  listCharacters(projectId: string): Character[]
  upsertCharacter(character: Character): Character
  deleteCharacter(id: string): void

  // 伏笔
  listForeshadowing(projectId: string): Foreshadowing[]
  upsertForeshadowing(item: Foreshadowing): Foreshadowing

  // 全文搜索
  search(projectId: string, query: string): Array<{ chapterId: string; snippet: string }>

  // 设置
  getSetting<T>(key: string, defaultValue: T): T
  setSetting<T>(key: string, value: T): void
}
```

> M0 使用 JSON 实现此接口；M1 切换为 SQLite 实现，上层代码零修改。

---

## 五、Agent 编排架构

### 5.1 Agent 类型体系

```typescript
type AgentType = 'outline' | 'writer' | 'polish' | 'review' | 'world'
```

### 5.2 编排流程

```
用户输入
    │
    ▼
┌──────────────┐
│ Router Agent │  规则式意图路由（M0）/ LLM 意图分类（M2）
└──────┬───────┘
       │
       ▼
┌──────────────┐
│Context Builder│ 组装上下文：
│              │  - recentText (近 2k-4k 字)
│              │  - chapterOutline (本章大纲)
│              │  - characterCards (相关人物)
│              │  - ragSnippets (RAG 检索结果)
│              │  - selection (用户选区)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Agent Core  │  构造 system + user messages
│  Orchestrator│  选择对应 system prompt
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ LLM Gateway  │  路由到具体 Provider
│              │  流式输出 AsyncIterable<LLMStreamEvent>
└──────┬───────┘
       │
       ▼
 IPC stream → Renderer
```

### 5.3 上下文组装策略（M1 目标）

```typescript
interface AgentContext {
  recentText?: string        // 当前章节尾部 2000~4000 字
  chapterOutline?: string    // 本章大纲字段
  characterCards?: string    // 相关人物卡（Markdown 格式）
  ragSnippets?: string[]     // RAG 检索的 top-5 相关段落
  selection?: string         // 用户选中的文字（润色用）
}

// 上下文 Token 预算分配
const TOKEN_BUDGET = {
  system: 500,              // system prompt
  chapterOutline: 200,      // 大纲
  characterCards: 600,      // 人物卡（最多 3 张）
  ragSnippets: 1000,        // RAG（最多 5 段）
  recentText: 3000,         // 近文
  userInput: 200,           // 用户指令
  // 总计 ≈ 5500 tokens，留 2500 给输出
}
```

### 5.4 Router Agent 实现

```typescript
// 当前：规则式路由
export function routeIntent(input: string, hasSelection: boolean): AgentType {
  if (hasSelection) {
    if (/(润色|改写|换风格|缩写|扩写|去.{0,3}味)/.test(input)) return 'polish'
    if (/(审校|检查|一致性|冲突)/.test(input)) return 'review'
    return 'polish'  // 有选区默认润色
  }
  if (/(大纲|三幕|分卷|分章)/.test(input)) return 'outline'
  if (/(审校|检查|一致性|伏笔|时间线)/.test(input)) return 'review'
  if (/(人物|世界观|地点|势力)/.test(input)) return 'world'
  return 'writer'  // 默认续写
}

// M2 目标：LLM 意图分类
export async function routeIntentLLM(
  input: string,
  hasSelection: boolean,
  gateway: LLMGateway
): Promise<AgentType> {
  // 调用小模型做意图分类
  // 输出 JSON: { intent: AgentType }
}
```

---

## 六、LLM Gateway 架构

### 6.1 Provider 适配器模式

```typescript
// 接口
export interface LLMProviderAdapter {
  readonly name: LLMProvider
  stream(messages: AgentMessage[], config: LLMConfig): AsyncIterable<LLMStreamEvent>
}

// 注册多个 Provider
gateway.register(new MockProvider())
gateway.register(new OpenAICompatibleProvider('openai'))
gateway.register(new OpenAICompatibleProvider('deepseek'))
gateway.register(new OpenAICompatibleProvider('ollama'))
// M2: gateway.register(new AnthropicProvider())
```

### 6.2 Provider 路由与降级

```typescript
// M1 目标：降级链
const FALLBACK_CHAIN: LLMProvider[] = ['deepseek', 'openai', 'ollama', 'mock']

async *streamWithFallback(
  messages: AgentMessage[],
  config: LLMConfig
): AsyncIterable<LLMStreamEvent> {
  for (const provider of FALLBACK_CHAIN) {
    try {
      yield* this.stream(messages, { ...config, provider })
      return
    } catch (err) {
      console.warn(`[LLM] ${provider} failed, trying next:`, err.message)
    }
  }
  throw new Error('All LLM providers failed')
}
```

### 6.3 SSE 流式解析

```typescript
// OpenAI 兼容协议 SSE 解析核心逻辑
async *parseSSEStream(body: ReadableStream): AsyncIterable<LLMStreamEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buf = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''

    for (const raw of lines) {
      const line = raw.trim()
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (payload === '[DONE]') {
        yield { delta: '', done: true }
        return
      }
      try {
        const json = JSON.parse(payload)
        const delta = json.choices?.[0]?.delta?.content ?? ''
        if (delta) yield { delta, done: false }
      } catch { /* 忽略非 JSON 行 */ }
    }
  }
  yield { delta: '', done: true }
}
```

### 6.4 配置管理

```typescript
// 环境变量读取
function readConfigFromEnv(): Partial<LLMConfig> {
  return {
    provider: (process.env.MW_LLM_PROVIDER as LLMProvider) || 'mock',
    model: process.env.MW_LLM_MODEL || 'mock-1',
    apiKey: process.env.MW_LLM_API_KEY,
    baseURL: process.env.MW_LLM_BASE_URL,
  }
}

// M1: 持久化到 SQLite settings 表
// M2: UI 设置面板可动态切换
```

---

## 七、RAG 引擎架构

### 7.1 架构分层

```
┌─────────────────────────────────────┐
│           RAG Engine                 │
├──────────┬──────────┬───────────────┤
│ Chunker  │ Embedder │ VectorStore   │
│ (切片)   │ (向量化) │ (存储+检索)   │
└──────────┴──────────┴───────────────┘
```

### 7.2 接口定义

```typescript
// Embedder 接口
export interface Embedder {
  readonly dim: number
  embed(text: string): Promise<Float32Array>
  embedBatch(texts: string[]): Promise<Float32Array[]>
}

// VectorStore 接口
export interface VectorStore {
  upsert(items: VectorRecord[]): Promise<void>
  search(query: string, topK: number, projectId?: string): Promise<SearchHit[]>
  delete(ids: string[]): Promise<void>
  clear(projectId?: string): void
}

// Chunker 接口（M1 新增）
export interface Chunker {
  chunk(text: string, chapterId: string): ChunkResult[]
}

export interface ChunkResult {
  id: string          // chunk hash
  text: string
  chapterId: string
  offset: number      // 在原文中的起始位置
  length: number
}
```

### 7.3 实现演进

| 阶段 | Embedder | VectorStore | Chunker |
|---|---|---|---|
| M0 | HashBagEmbedder (占位) | InMemoryVectorStore | 无 |
| M1 | bge-m3 (ONNX 本地) | InMemoryVectorStore | 滑动窗口 (500 字, 100 overlap) |
| M2 | bge-m3 + text-embedding-3 | LanceDB 持久化 | 语义边界切分 |

### 7.4 索引流程

```
章节保存
    │
    ▼
┌──────────┐     ┌──────────┐     ┌──────────┐
│ Chunker  │ ──▶ │ Embedder │ ──▶ │VectorStore│
│ (切片)   │     │ (向量化) │     │ (upsert) │
└──────────┘     └──────────┘     └──────────┘
```

增量策略：

```typescript
// 按 chunk hash 判断是否需要重新 embed
function shouldReEmbed(newChunk: ChunkResult, existingId: string): boolean {
  return newChunk.id !== existingId  // hash 不同则重新 embed
}
```

### 7.5 检索流程

```
用户续写请求
    │
    ▼
┌──────────┐     ┌──────────┐     ┌──────────────┐
│ Query    │ ──▶ │ Embedder │ ──▶ │ VectorStore  │
│ (近文)   │     │ (向量化) │     │ .search(q,5) │
└──────────┘     └──────────┘     └──────┬───────┘
                                          │
                                          ▼
                                   top-5 SearchHit[]
                                          │
                                          ▼
                                   注入 AgentContext.ragSnippets
```

---

## 八、Worker 进程池

### 8.1 设计目标

主进程零阻塞：所有耗时 > 100ms 的任务走 Worker。

### 8.2 Worker 任务类型

| 任务 | 耗时 | 触发时机 |
|---|---|---|
| 批量 Embedding | 秒~分 | 项目首次索引 / 章节大改 |
| 全书审校 | 秒~分 | 用户手动触发 |
| 世界观抽取 | 秒 | 保存后后台执行 |
| 导出项目包 | 秒 | 用户手动触发 |

### 8.3 实现方案

```typescript
// apps/desktop/src/main/worker/pool.ts
import { Worker } from 'worker_threads'

export class WorkerPool {
  private workers: Worker[] = []
  private queue: Task[] = []

  constructor(private maxWorkers = 2) {}

  async submit<T>(script: string, data: unknown): Promise<T> {
    // 排队 + 取空闲 Worker / 创建新 Worker
    // Worker 完成后回收到池中
  }
}

// Worker 脚本示例
// apps/desktop/src/main/worker/embed-worker.ts
import { parentPort, workerData } from 'worker_threads'
import { BGE_M3_Embedder } from '@magic-writer/rag'

const embedder = new BGE_M3_Embedder()
const { texts } = workerData
const vectors = await embedder.embedBatch(texts)
parentPort?.postMessage({ vectors })
```

---

## 九、IPC 契约完整定义

### 9.1 Channel 命名规范

```
{domain}:{action}

domain = project | chapter | agent | world | app | settings
action = list | get | create | update | delete | run | ...
```

### 9.2 完整 Channel 列表（M1 目标）

```typescript
export const IPC = {
  // 系统
  AppVersion: 'app:version',

  // 项目
  ProjectList: 'project:list',
  ProjectGet: 'project:get',
  ProjectCreate: 'project:create',
  ProjectUpdate: 'project:update',
  ProjectDelete: 'project:delete',

  // 章节
  ChapterList: 'chapter:list',
  ChapterGet: 'chapter:get',
  ChapterSave: 'chapter:save',
  ChapterCreate: 'chapter:create',
  ChapterDelete: 'chapter:delete',
  ChapterSearch: 'chapter:search',    // FTS5 全文搜索

  // Agent
  AgentRun: 'agent:run',
  AgentStreamChunk: 'agent:stream-chunk',  // push: main → renderer
  AgentStop: 'agent:stop',                 // 中断生成

  // 世界观
  WorldCharacterList: 'world:character:list',
  WorldCharacterUpsert: 'world:character:upsert',
  WorldCharacterDelete: 'world:character:delete',
  WorldForeshadowingList: 'world:foreshadowing:list',
  WorldForeshadowingUpsert: 'world:foreshadowing:upsert',

  // 设置
  SettingsGet: 'settings:get',
  SettingsSet: 'settings:set',
} as const
```

### 9.3 请求/响应类型约束

```typescript
// 定义 IPC 类型映射（M1 增强）
export interface IPCMap {
  [IPC.ProjectList]: { req: void; res: ProjectListResponse }
  [IPC.ProjectGet]: { req: string; res: Project | null }
  [IPC.ProjectCreate]: { req: ProjectCreateRequest; res: Project }
  [IPC.ChapterSave]: { req: ChapterSaveRequest; res: Chapter | null }
  [IPC.AgentRun]: { req: AgentRunRequest; res: AgentRunResponse }
  // ...
}

// 类型安全的 invoke 封装
function typedInvoke<C extends keyof IPCMap>(
  channel: C,
  ...args: IPCMap[C]['req'] extends void ? [] : [IPCMap[C]['req']]
): Promise<IPCMap[C]['res']> {
  return ipcRenderer.invoke(channel, ...args)
}
```

---

## 十、安全架构

### 10.1 进程隔离

```
┌─────────────────┐     contextBridge      ┌──────────────────┐
│ Renderer        │ ◄──────────────────────▶│ Preload          │
│ (不可信 Web)    │     只暴露 window.api    │ (受限环境)       │
│                 │                          │                  │
│ sandbox: false  │                          │ 可访问 ipcRenderer│
│ (当前; M2:true) │                          │ 不可访问 Node    │
└─────────────────┘                          └──────────────────┘
                                                      │
                                               ipcRenderer
                                                      ▼
                                             ┌──────────────────┐
                                             │ Main Process     │
                                             │ (完全 Node 环境)  │
                                             └──────────────────┘
```

### 10.2 安全原则

| 原则 | 实现 |
|---|---|
| 最小暴露 | Renderer 只能通过 `window.api` 的白名单方法与主进程通信 |
| 输入校验 | IPC handler 校验参数类型与范围 |
| 不暴露文件系统 | Renderer 无 `require('fs')` 能力 |
| API Key 安全 | 存储在主进程环境变量或加密 settings 中 |
| SQL 注入防护 | better-sqlite3 使用参数化查询 |

### 10.3 API Key 存储

```typescript
// M0: 环境变量
process.env.MW_LLM_API_KEY

// M1: 加密存储在 SQLite
import { safeStorage } from 'electron'

function encryptApiKey(key: string): Buffer {
  return safeStorage.encryptString(key)
}

function decryptApiKey(encrypted: Buffer): string {
  return safeStorage.decryptString(encrypted)
}
```

---

## 十一、错误处理与可靠性

### 11.1 错误分类

| 类型 | 处理策略 |
|---|---|
| LLM 网络超时 | 重试 1 次 → 降级下一个 Provider → 报错 |
| LLM 返回错误 | 解析错误信息 → 通过 stream-chunk.error 通知前端 |
| SQLite 写入失败 | 重试 → 日志 → 通知用户 |
| Worker 崩溃 | 重启 Worker → 回报错误 |
| 主进程未捕获异常 | Sentry 上报 + 优雅退出 |

### 11.2 Agent 中断机制

```typescript
// M1: 支持用户中断 Agent 生成
ipcMain.handle(IPC.AgentStop, (_e, requestId: string) => {
  // 通过 AbortController 中断进行中的 LLM 请求
  const controller = activeRequests.get(requestId)
  controller?.abort()
  activeRequests.delete(requestId)
})
```

---

## 十二、性能策略

### 12.1 主进程性能原则

| 原则 | 实现 |
|---|---|
| 同步 IO 用 better-sqlite3 | 避免 async callback 地狱 |
| 重任务走 Worker | Embedding、全书审校不阻塞主线程 |
| 懒加载模块 | LLM Gateway / RAG 首次调用时初始化 |
| LRU 缓存 | 章节内容缓存最近 10 章 |
| 增量索引 | chunk hash 判断变更 |

### 12.2 关键性能指标

| 操作 | 目标 | 实现方式 |
|---|---|---|
| 项目列表加载 | < 10ms | SQLite 索引 |
| 章节内容读取 | < 5ms | fs.readFileSync + LRU 缓存 |
| 章节保存 | < 50ms | SQLite WAL + async fs.writeFile |
| RAG 检索 | < 50ms | LanceDB HNSW |
| 首 Token 延迟 | < 500ms | LLM 端决定 |
| 全书索引(50w字) | < 30s | Worker + 批量 Embedding |

---

## 十三、日志与监控

### 13.1 日志分级

```typescript
import { createLogger } from './utils/logger'

const log = createLogger('Storage')

log.info('Project created', { id: project.id })
log.warn('Chapter not found', { chapterId })
log.error('SQLite write failed', { error })
log.debug('RAG search results', { hits: results.length })
```

### 13.2 崩溃报告（M2）

```typescript
// Sentry 集成（可选、用户可关闭）
import * as Sentry from '@sentry/electron/main'

Sentry.init({
  dsn: 'https://xxx@sentry.io/xxx',
  enabled: settings.get('telemetry', false),
})
```

---

## 十四、后端演进路线

| 阶段 | 后端关键交付 |
|---|---|
| **M0 ✅** | JSON 存储、IPC 框架、LLM Gateway(Mock+OpenAI)、Agent Orchestrator |
| **M1** | SQLite+FTS5、上下文组装完善、RAG InMemory 闭环、bge-m3 Embedder、Agent Stop |
| **M2** | LanceDB 持久化、Worker 池、全书审校、降级链、Sentry |
| **M3** | 云同步加密层、账号模块、插件 Sandbox、自动更新 |

---

## 十五、开发规范

### 15.1 代码规范

| 规范 | 说明 |
|---|---|
| 文件命名 | kebab-case (`llm-gateway.ts`) 或 index.ts 入口 |
| 函数 | camelCase，纯函数优先 |
| 类 | PascalCase，面向接口编程 |
| 类型 | 定义在 `@magic-writer/shared`，全栈共享 |
| 异步 | 优先 `async/await`，流式用 `AsyncIterable` |
| 错误 | 自定义 Error 类，包含 code + message |

### 15.2 Package 开发原则

```
1. packages/* 不依赖 Electron API（可独立跑单测）
2. apps/desktop/src/main 是唯一接触 Electron 的后端代码
3. 每个 package 有独立 tsconfig.json
4. workspace:* 依赖方式，构建时由 electron-vite bundle
5. 接口先行：先定义 interface，再做实现
```

### 15.3 测试策略

```
packages/shared         → 类型测试（tsc --noEmit）
packages/llm-gateway    → 单测（Mock HTTP、流式解析）
packages/agent-core     → 单测（Prompt 构造、Router 逻辑）
packages/rag            → 单测（Embedder、向量检索正确性）
apps/desktop/src/main   → 集成测试（IPC handler + Storage）
```

---

> 本文档随后端架构演进持续更新。所有模块实现应对照此文档验证一致性。
