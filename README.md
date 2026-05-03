# Magic Writer

AI 驱动的桌面端小说创作工具（Electron + React + Monaco）。详细设计见 [`docs/design.md`](./docs/design.md)。

## 当前进度

已完成 M0 原型骨架：

- ✅ pnpm monorepo：`apps/desktop` + `packages/{shared,llm-gateway,agent-core,rag}`
- ✅ 主进程：Storage（JSON 占位，待接入 better-sqlite3）、IPC、LLM Gateway、Agent Orchestrator
- ✅ Preload：类型安全的 `window.api`
- ✅ Renderer：三栏布局（项目树 / Monaco 编辑器 / Agent 对话）、Zustand 状态、全局快捷键
- ✅ 流式续写端到端：Renderer → IPC → Orchestrator → LLMGateway（默认 Mock，可切换 OpenAI/DeepSeek/Ollama）
- ✅ 首次启动 seed 一个"我的修仙文"演示项目

## 目录结构

```
magic-writer/
├── apps/desktop/               Electron 应用
│   └── src/{main,preload,renderer}
├── packages/
│   ├── shared/                 共享类型 + IPC 契约
│   ├── llm-gateway/            多模型适配（mock / openai 兼容协议）
│   ├── agent-core/             Agent 编排 + prompt 模板
│   └── rag/                    向量检索接口（含 hash-bag 占位实现）
└── docs/design.md              产品 & 技术设计
```

## 开发

```bash
pnpm install
pnpm dev         # 启动 Electron（开发模式，默认 Mock LLM）
pnpm build       # 构建三进程产物到 out/
pnpm build:mac   # 打包 dmg
```

## 接入真实 LLM

通过环境变量切换 provider（默认 `mock`）：

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

## 快捷键

| 快捷键 | 功能 |
|---|---|
| `⌘S` | 保存当前章节 |
| `⌘B` | 切换左侧项目栏 |
| `⌘J` | 切换右侧 Agent 栏 |
| `⌘⇧F` | 写作模式（隐藏两侧） |
| `⌘⏎`（Agent 输入框内） | 发送 |

## 下一步路线

- [ ] 把 `apps/desktop/src/main/storage` 从 JSON 换成 `better-sqlite3` + FTS5
- [ ] 把 `packages/rag` 的 hash-bag embedder 换成 bge-m3 + LanceDB
- [ ] ReviewAgent：人设/时间线/伏笔冲突检测
- [ ] 命令面板 `⌘K`
- [ ] 打字机写作模式 + 目标字数庆祝动画
