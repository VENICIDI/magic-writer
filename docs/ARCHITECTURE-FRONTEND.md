# Magic Writer — 前端架构文档

> 版本：v1.0 · 更新日期：2026-05-03
> 语言：TypeScript 全栈
> 配套文档：[后端架构](./ARCHITECTURE-BACKEND.md) · [PRD](./PRD.md) · [设计规范](./DESIGN-SYSTEM.md)

---

## 一、架构总览

```
┌─────────────────────────────────────────────────────────────┐
│                  Electron Renderer Process                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                    React App                           │  │
│  │                                                       │  │
│  │  ┌─────────┐  ┌─────────────┐  ┌───────────────────┐│  │
│  │  │  Views  │  │  Components │  │   Stores (Zustand) ││  │
│  │  │         │  │             │  │                    ││  │
│  │  │ ·App    │  │ ·Sidebar    │  │ ·useProjectStore  ││  │
│  │  │ ·Editor │  │ ·Editor     │  │ ·useAgentStore    ││  │
│  │  │ ·Agent  │  │ ·AgentPanel │  │ ·useSettingsStore ││  │
│  │  │ ·World  │  │ ·StatusBar  │  │ ·useWorldStore    ││  │
│  │  │         │  │ ·CommandK   │  │                    ││  │
│  │  └─────────┘  └─────────────┘  └───────────────────┘│  │
│  │                                                       │  │
│  │  ┌───────────────────────────────────────────────────┐│  │
│  │  │              Hooks / Utils Layer                    ││  │
│  │  │  ·useIPC  ·useMonacoSelection  ·useShortcuts      ││  │
│  │  │  ·useAutoSave  ·useWordCount  ·useDailyGoal       ││  │
│  │  └───────────────────────────────────────────────────┘│  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              window.api (Preload Bridge)                │  │
│  │  ·project.*  ·chapter.*  ·agent.*  ·world.*  ·app.*   │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                  contextBridge (IPC)                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、技术栈

| 层级 | 技术 | 版本 | 选型理由 |
|---|---|---|---|
| **框架** | React | 19.x | 生态最大、Concurrent Mode |
| **语言** | TypeScript | 6.x | 端到端类型安全 |
| **构建** | Vite + electron-vite | 7.x / 5.x | 秒级 HMR |
| **编辑器** | Monaco Editor | latest | 百万字性能、VSCode 同款 |
| **状态管理** | Zustand | 5.x | 极简、无 Provider |
| **样式** | Tailwind CSS 4 | 4.x | 原子化、设计 Token 映射 |
| **UI 组件** | Radix UI（M1+） | - | 无障碍、headless |
| **可视化** | ReactFlow（关系图）/ ECharts（统计） | - | M2 引入 |
| **路由** | 无（单窗口 SPA） | - | Electron 桌面应用 |

---

## 三、目录结构

```
apps/desktop/src/renderer/
├── main.tsx                    # 入口：ReactDOM.createRoot
├── App.tsx                     # 根布局：三栏 + 快捷键 + 启动引导
├── App.css                     # Tailwind 入口 + 主题 Token
│
├── components/                 # 展示组件（无业务逻辑）
│   ├── Sidebar.tsx             # 左侧栏：项目树
│   ├── Editor.tsx              # Monaco Markdown 编辑器
│   ├── AgentPanel.tsx          # 右侧 Agent 对话面板
│   ├── StatusBar.tsx           # 底部状态栏
│   ├── CommandPalette.tsx      # ⌘K 命令面板（M1）
│   ├── SelectionToolbar.tsx    # 选区浮动工具条（M1）
│   ├── DailyGoal.tsx           # 字数目标进度条（M1）
│   ├── WorldPanel/             # 世界观面板（M1）
│   │   ├── CharacterCard.tsx
│   │   ├── CharacterList.tsx
│   │   └── CharacterForm.tsx
│   ├── ReviewReport.tsx        # 审校报告（M2）
│   └── RelationGraph.tsx       # 人物关系图（M2）
│
├── stores/                     # Zustand Store
│   ├── project.ts              # 项目/卷/章节/编辑器内容
│   ├── agent.ts                # Agent 会话/流式状态
│   ├── settings.ts             # 用户设置（M1）
│   └── world.ts                # 世界观库（M1）
│
├── hooks/                      # 自定义 Hooks（M1）
│   ├── useIPC.ts               # 封装 window.api 调用
│   ├── useMonacoSelection.ts   # 获取 Monaco 选区
│   ├── useShortcuts.ts         # 全局快捷键注册
│   ├── useAutoSave.ts          # 自动保存逻辑
│   └── useWordCount.ts         # 实时字数计算
│
├── utils/                      # 纯函数工具
│   ├── wordCount.ts            # 中英文字数计算
│   ├── markdown.ts             # Markdown 处理
│   └── id.ts                   # ID 生成
│
└── env.d.ts                    # Vite 环境类型声明
```

---

## 四、状态管理架构

### 4.1 Store 拆分原则

| Store | 职责 | 持久化 |
|---|---|---|
| `useProjectStore` | 项目列表、当前项目、卷/章节、编辑器内容、UI 状态 | 通过 IPC 读写主进程 |
| `useAgentStore` | Agent 会话历史、流式状态、活跃 Agent 类型 | 内存（可选持久化） |
| `useSettingsStore` | 用户偏好设置（主题、字体、模型、快捷键） | localStorage + IPC |
| `useWorldStore` | 人物卡、地点、伏笔等世界观数据 | 通过 IPC 读写主进程 |

### 4.2 数据流

```
┌─────────────┐     IPC invoke      ┌─────────────┐
│  Zustand    │ ──────────────────▶  │  Main       │
│  Store      │                      │  Process    │
│             │ ◀──────────────────  │  (Backend)  │
└─────────────┘   IPC response/event └─────────────┘
       │
       │ subscribe
       ▼
┌─────────────┐
│  React      │
│  Component  │
└─────────────┘
```

### 4.3 Store 设计规范

```typescript
// ✅ 推荐模式
interface ProjectState {
  // 数据
  projects: Project[]
  currentProject: Project | null

  // 派生（getter 模式）
  // 不存储可计算值

  // UI 临时状态
  sidebarVisible: boolean

  // 异步 Actions
  bootstrap: () => Promise<void>
  openProject: (id: string) => Promise<void>

  // 同步 Actions
  setContent: (content: string) => void
  toggleSidebar: () => void
}

// ✅ 规范
// 1. Store 粒度以"领域边界"划分，不按页面划分
// 2. Actions 放在 Store 内部（Zustand 原生写法）
// 3. 异步 Actions 内部处理 error（try/catch）
// 4. 跨 Store 依赖通过 getState() 获取，不用 subscribe
```

---

## 五、组件架构

### 5.1 组件分层

```
├── 页面级组件（Views）
│   └── App.tsx                  布局 + 生命周期
│
├── 容器组件（Connected）
│   ├── Sidebar.tsx              连接 useProjectStore
│   ├── Editor.tsx               连接 useProjectStore
│   ├── AgentPanel.tsx           连接 useAgentStore + useProjectStore
│   └── StatusBar.tsx            连接 useProjectStore
│
├── 展示组件（Pure / Presentational）
│   ├── Button.tsx               通用按钮
│   ├── Dialog.tsx               通用弹窗
│   ├── Tooltip.tsx              提示气泡
│   └── ...
│
└── 原子组件（Primitives）
    └── Radix UI                 headless 原子组件
```

### 5.2 组件通信规范

| 场景 | 方式 |
|---|---|
| 父 → 子 | Props |
| 子 → 父 | 回调 Props |
| 兄弟组件 | Zustand Store |
| 跨层级 | Zustand Store（不用 Context） |
| 主进程 → Renderer | IPC event → Store update |

### 5.3 Monaco 编辑器集成

```typescript
// 编辑器实例通过 ref 暴露
const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)

// 选区获取 Hook
function useMonacoSelection(editorRef: RefObject<...>) {
  const getSelection = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return ''
    const sel = editor.getSelection()
    if (!sel) return ''
    return editor.getModel()?.getValueInRange(sel) ?? ''
  }, [editorRef])

  return { getSelection }
}

// 流式写入
function appendText(editor: monaco.editor.IStandaloneCodeEditor, text: string) {
  const model = editor.getModel()
  if (!model) return
  const lastLine = model.getLineCount()
  const lastCol = model.getLineMaxColumn(lastLine)
  editor.executeEdits('agent-stream', [{
    range: new monaco.Range(lastLine, lastCol, lastLine, lastCol),
    text,
  }])
  // 滚动到底部
  editor.revealLine(model.getLineCount())
}
```

---

## 六、IPC 通信层

### 6.1 通信模型

```
Renderer (React)
    │
    │ window.api.xxx()  (Preload 暴露)
    ▼
Preload
    │
    │ ipcRenderer.invoke(channel, payload)
    ▼
Main Process
    │
    │ ipcMain.handle(channel, handler)
    ▼
  业务逻辑 (Storage / Agent / LLM)
    │
    │ 返回结果 / 发送事件
    ▼
Renderer (通过 Promise resolve 或 event listener)
```

### 6.2 类型安全 IPC

```typescript
// packages/shared/src/index.ts 定义契约
export const IPC = {
  ProjectList: 'project:list',
  ProjectGet: 'project:get',
  ChapterSave: 'chapter:save',
  AgentRun: 'agent:run',
  AgentStreamChunk: 'agent:stream-chunk',  // main → renderer (push)
} as const

// Preload 类型化封装
const api = {
  project: {
    list: (): Promise<ProjectListResponse> =>
      ipcRenderer.invoke(IPC.ProjectList),
  },
  agent: {
    run: (req: AgentRunRequest): Promise<AgentRunResponse> =>
      ipcRenderer.invoke(IPC.AgentRun, req),
    onStreamChunk: (handler: (chunk: LLMStreamChunk) => void) => {
      const listener = (_e: unknown, chunk: LLMStreamChunk) => handler(chunk)
      ipcRenderer.on(IPC.AgentStreamChunk, listener)
      return () => ipcRenderer.removeListener(IPC.AgentStreamChunk, listener)
    }
  }
}

// window.api 类型声明
export type MagicWriterAPI = typeof api
declare global {
  interface Window {
    api: MagicWriterAPI
  }
}
```

### 6.3 流式通信模式

```
Renderer                    Main Process
   │                            │
   │──── agent:run ────────────▶│  (invoke, 同步触发)
   │                            │
   │                            │── for await (LLMGateway.stream)
   │                            │       │
   │◀─── agent:stream-chunk ────│       │ (event push, 逐 token)
   │◀─── agent:stream-chunk ────│       │
   │◀─── agent:stream-chunk ────│       │
   │◀─── agent:stream-chunk ────│       │ done: true
   │                            │
   │◀─── invoke resolve ────────│  (AgentRunResponse)
   │                            │
```

---

## 七、路由与页面管理

### 7.1 当前方案：单页面 + 状态切换

由于是 Electron 单窗口桌面应用，不使用 React Router。

```typescript
// 通过 Store 状态控制视图切换
const view = useProjectStore(s => s.currentView)

// 可能的视图：
type AppView = 'editor' | 'world' | 'outline' | 'settings' | 'analytics'
```

### 7.2 M2 多窗口规划

```typescript
// 未来支持多窗口（如分离 Agent 面板）
// 使用 Electron BrowserWindow + 独立入口
// 窗口间通信通过 Main Process 中继
```

---

## 八、样式系统

### 8.1 Tailwind 4 配置

```css
/* App.css */
@import "tailwindcss";

@theme {
  --color-surface-900: #050507; /* Abyss Black */
  --color-surface-800: #0b0b0c;
  --color-surface-700: #101010; /* Carbon Surface */
  --color-surface-600: #3d3a39; /* Warm Charcoal */
  --color-surface-500: #4f4b49;
  --color-accent: #00d992;      /* Emerald Signal Green */
  --color-accent-light: #2fd6a1;/* VoltAgent Mint */
  --font-sans: 'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --font-mono: 'SFMono-Regular', 'JetBrains Mono', Menlo, Monaco, Consolas, monospace;
}
```

### 8.2 样式规范

| 规则 | 说明 |
|---|---|
| 使用 Tailwind 原子类 | 不写自定义 CSS（极少例外） |
| 组件级样式 | 直接写在 className 中 |
| 主题变量 | 通过 `@theme` 定义 Token |
| 响应式 | 不需要（桌面应用），仅需窗口最小宽度保护 |
| 暗色主题 | 默认且唯一（M1），浅色主题 M2 |

---

## 九、性能优化策略

### 9.1 编辑器性能

| 策略 | 实现 |
|---|---|
| 按章节分文件 | 单文件 ≤ 5w 字 |
| viewport 渲染 | Monaco 原生支持 |
| 关闭非必要功能 | minimap: off, lineNumbers: off, folding: off |
| lazy loading | 非当前章节不加载到 Monaco |

### 9.2 渲染性能

| 策略 | 实现 |
|---|---|
| Store selector | 精确选择需要的字段，避免全量 re-render |
| React.memo | 对 pure 展示组件 memo 化 |
| 虚拟滚动 | 长列表（章节列表、对话历史）使用虚拟化 |
| 流式批处理 | Agent 流式文本使用 rAF 批量 DOM 更新 |

### 9.3 首屏优化

```typescript
// 懒加载非核心面板
const WorldPanel = lazy(() => import('./components/WorldPanel'))
const ReviewReport = lazy(() => import('./components/ReviewReport'))
const RelationGraph = lazy(() => import('./components/RelationGraph'))

// 首屏只渲染：Sidebar + Editor + StatusBar
// Agent Panel 延迟 100ms 渲染（不阻塞首屏）
```

---

## 十、测试策略

### 10.1 测试金字塔

```
         ┌──────────┐
         │   E2E    │  Playwright (少量关键路径)
        ─┼──────────┼─
       ┌─┴──────────┴─┐
       │  Integration  │  vitest + @testing-library/react
      ─┼───────────────┼─
     ┌─┴───────────────┴─┐
     │      Unit Tests     │  vitest (Stores / Hooks / Utils)
     └─────────────────────┘
```

### 10.2 测试重点

| 层 | 测试重点 |
|---|---|
| Store | Action 逻辑、状态变更正确性 |
| Hooks | useAutoSave、useWordCount 等纯逻辑 Hook |
| Utils | wordCount、markdown 解析等纯函数 |
| 组件 | AgentPanel 流式渲染、Sidebar 交互 |
| E2E | 完整写作流程：打开 → 编辑 → AI 续写 → 保存 |

---

## 十一、错误处理

### 11.1 错误边界

```typescript
// 全局 ErrorBoundary
<ErrorBoundary fallback={<CrashScreen />}>
  <App />
</ErrorBoundary>

// 面板级 ErrorBoundary（Agent 面板崩溃不影响编辑器）
<ErrorBoundary fallback={<AgentPanelError />}>
  <AgentPanel />
</ErrorBoundary>
```

### 11.2 IPC 错误处理

```typescript
// Store 内统一处理
saveCurrent: async () => {
  try {
    const result = await window.api.chapter.save({ ... })
    if (result) set({ saved: true })
  } catch (err) {
    // 展示 toast 通知
    console.error('[Save Error]', err)
    // 不崩溃，保留本地内容
  }
}
```

---

## 十二、前端演进路线

| 阶段 | 前端关键交付 |
|---|---|
| **M0 ✅** | 三栏布局、Monaco 集成、Zustand Store、Agent 流式对话 |
| **M1** | 选区交互、命令面板、世界观 UI、设置面板、虚拟滚动 |
| **M2** | 人物关系图（ReactFlow）、Diff 视图、审校报告 UI、性能监控 |
| **M3** | 插件系统前端容器、多窗口、浅色主题、国际化 |

---

> 本文档随前端架构演进持续更新。
