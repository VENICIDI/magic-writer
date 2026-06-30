# Magic Writer

AI 驱动的桌面端小说创作工具（Electron + React + Monaco）。详细设计见 [`docs/design.md`](./docs/design.md)。

## 功能概览

- 📚 **作品库 + 工作区**：左侧导航在「小说作品」库与当前作品工作区之间切换，三栏布局（项目树 / Monaco 编辑器 / Agent 对话）。
- 🤖 **多类型 Agent**：续写（writer）、润色（polish）、审校（review）、大纲（outline）、世界观（world），由规则式 Router 根据输入与选区自动路由意图。
- ⚡ **流式续写端到端**：Renderer → IPC → Orchestrator → LLM Gateway，支持 OpenAI / DeepSeek / Ollama（默认 Mock），统一走 OpenAI 兼容的 `/chat/completions` 流式协议。
- 🧠 **上下文增强**：生成时自动注入近文、章节大纲、人物卡，并通过 RAG 检索相关前文片段。
- 🎨 **风格学习**：续写 / 润色时从历史正文提取风格样本注入 prompt（可在设置中开关）。
- 🔍 **审校与伏笔/关系**：审校面板、伏笔追踪、人物关系图（基于 @xyflow/react）。
- 🌏 **世界观分析**：内嵌本地分析服务，上传 txt 长篇小说，提取主线 / 世界观 / 角色 / 物品并生成报告（LangGraph Agent）。
- 🎯 **每日目标**：码字进度条 + 达成庆祝动画；写作模式（隐藏两侧专注写作）。
- ⌘ **命令面板 `⌘K`** 与全局快捷键。
- 💾 **持久化**：`better-sqlite3`（WAL + 迁移）存元数据，章节正文按文件存储。

## 技术栈

- **桌面框架**：Electron 41 + electron-vite，主 / preload / renderer 三进程，类型安全的 `window.api`
- **前端**：React 19 + Tailwind CSS 4 + Zustand + Monaco 编辑器 + @xyflow/react
- **存储**：better-sqlite3（meta.db，含迁移）+ 章节文件
- **AI**：自研 LLM Gateway（多 provider）+ Agent Orchestrator + RAG（hash-bag 占位 embedder）

## 目录结构

```
magic-writer/
├── apps/desktop/               Electron 应用
│   └── src/
│       ├── main/               主进程：storage(SQLite) / ipc / llm / agents / worldview / worker
│       ├── preload/            类型安全的 window.api
│       └── renderer/           React UI（components / stores / hooks）
├── packages/
│   ├── shared/                 共享类型 + IPC 契约
│   ├── llm-gateway/            多模型适配（mock / openai 兼容协议）
│   ├── agent-core/             Agent 编排 + Router + prompt 模板
│   ├── rag/                    向量检索接口（含 hash-bag 占位实现）
│   └── worldview-analyzer/     百万字小说世界观分析（LangGraph Agent + HTTP 服务）
└── docs/                       PRD / design / 架构 / 设计系统文档
```

## 开发

```bash
pnpm install
pnpm dev            # 启动 Electron（开发模式，默认 Mock LLM）
pnpm worldview:dev  # 单独启动世界观分析 HTTP 服务（端口 8000）
pnpm build          # 构建三进程产物到 out/
pnpm build:mac      # 打包 dmg（另有 build:win / build:linux）
```

## 接入真实 LLM

可在应用「设置」面板中配置 Provider / Model / API Key，也可通过环境变量切换（默认 `mock`）：

```bash
# OpenAI
export MW_LLM_PROVIDER=openai
export MW_LLM_MODEL=gpt-4o-mini
export MW_LLM_API_KEY=sk-...

# DeepSeek
export MW_LLM_PROVIDER=deepseek
export MW_LLM_MODEL=deepseek-chat
export MW_LLM_API_KEY=sk-...

# 本地 Ollama
export MW_LLM_PROVIDER=ollama
export MW_LLM_MODEL=qwen2.5:7b
# 无需 API Key

pnpm dev
```

所有 Provider 都走 OpenAI 兼容的 `/chat/completions` 流式协议。

## 世界观分析

桌面端顶部 Tab「世界观分析」会内嵌启动本地分析服务，支持上传 txt 小说、提取主线 / 世界观 / 角色 / 物品并生成报告。

LLM 配置与写作模块共用设置面板中的 Provider / API Key；也可通过环境变量 `LLM_API_KEY` 或 `MW_LLM_API_KEY` 配置。

独立运行（浏览器访问 `http://localhost:8000`）：

```bash
cd packages/worldview-analyzer
cp .env.example .env   # 填入 LLM_API_KEY
pnpm dev
```

## 快捷键

| 快捷键 | 功能 |
|---|---|
| `⌘K` | 打开命令面板 |
| `⌘S` | 保存当前章节 |
| `⌘B` | 切换左侧项目栏 |
| `⌘J` | 切换右侧 Agent 栏 |
| `⌘⇧F` | 写作模式（隐藏两侧） |
| `⌘⏎`（Agent 输入框内） | 发送 |

## 下一步路线

- [ ] 把 `packages/rag` 的 hash-bag embedder 换成 bge-m3 + LanceDB（接入真实向量检索）
- [ ] ReviewAgent 增强：人设 / 时间线 / 伏笔冲突的自动检测与定位
- [ ] 码字统计页（字数趋势、写作时长）
- [ ] 章节级版本历史与 diff
- [ ] 命令面板补全「新建章节」等待办动作
