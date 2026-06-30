import { create } from 'zustand'
import { friendlyLLMError, type AgentType, type LLMStreamChunk } from '@magic-writer/shared'

export interface AgentTurn {
  id: string
  role: 'user' | 'assistant'
  content: string
  agentType?: AgentType
  done?: boolean
  error?: string
}

/** AI 流式写入编辑器的方式 */
export type EditorWriteMode = 'cursor' | 'replaceSelection'

/** 由 Editor 注册的写入控制器，供流式插入/替换正文使用 */
export interface EditorWriter {
  begin: (mode: EditorWriteMode) => void
  write: (delta: string) => void
  end: () => void
}

function getEditorWriter(): EditorWriter | undefined {
  return (window as unknown as { __mwEditor?: EditorWriter }).__mwEditor
}

interface AgentState {
  activeAgent: AgentType
  turns: AgentTurn[]
  running: boolean
  listenerInstalled: boolean
  currentRequestId: string | null
  /** 编辑器中当前选中的正文（供面板做选区感知提示，由 Editor 实时同步） */
  selectedText: string

  setActiveAgent: (a: AgentType) => void
  setSelectedText: (t: string) => void
  ensureListener: () => void
  send: (input: {
    input: string
    projectId?: string
    chapterId?: string
    selection?: string
    /** 覆盖当前 activeAgent（如右键润色强制 polish） */
    agentType?: AgentType
    /** 把流式文本写入编辑器的方式；不传则只在对话区显示 */
    editorMode?: EditorWriteMode
  }) => Promise<void>
  stop: () => void
  clear: () => void
}

export const useAgentStore = create<AgentState>((set, get) => ({
  activeAgent: 'writer',
  turns: [],
  running: false,
  listenerInstalled: false,
  currentRequestId: null,
  selectedText: '',

  setActiveAgent: (a) => set({ activeAgent: a }),
  setSelectedText: (t) => set((s) => (s.selectedText === t ? s : { selectedText: t })),

  ensureListener: () => {
    if (get().listenerInstalled) return
    window.api.agent.onStreamChunk((chunk: LLMStreamChunk) => {
      set((s) => {
        // 按 requestId 精确匹配气泡，避免并发请求时内容写错气泡
        const idx = s.turns.findIndex(
          (t) => t.id === chunk.requestId && t.role === 'assistant'
        )
        if (idx === -1) return s
        const turns = [...s.turns]
        const turn = { ...turns[idx] }
        turn.content += chunk.delta
        if (chunk.done) {
          turn.done = true
          if (chunk.error) turn.error = friendlyLLMError(chunk.error)
        }
        turns[idx] = turn
        const stopRunning = chunk.done && chunk.requestId === s.currentRequestId
        return {
          turns,
          running: stopRunning ? false : s.running,
          currentRequestId: stopRunning ? null : s.currentRequestId
        }
      })
    })
    set({ listenerInstalled: true })
  },

  send: async ({ input, projectId, chapterId, selection, agentType, editorMode }) => {
    get().ensureListener()
    const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const type = agentType ?? get().activeAgent

    set((s) => ({
      turns: [
        ...s.turns,
        { id: requestId + '-u', role: 'user', content: input },
        { id: requestId, role: 'assistant', content: '', agentType: type }
      ],
      running: true,
      currentRequestId: requestId
    }))

    // 流式写入编辑器：开始时记录锚点，逐 delta 插入/替换
    const writer = editorMode ? getEditorWriter() : undefined
    writer?.begin(editorMode as EditorWriteMode)

    let dispose: (() => void) | undefined
    if (writer) {
      dispose = window.api.agent.onStreamChunk((chunk) => {
        if (chunk.requestId !== requestId) return
        if (chunk.delta) writer.write(chunk.delta)
        if (chunk.done) {
          writer.end()
          dispose?.()
        }
      })
    }

    try {
      await window.api.agent.run({
        requestId,
        projectId: projectId ?? '',
        agentType: type,
        input,
        selection,
        chapterId
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      writer?.end()
      set((s) => ({
        running: false,
        currentRequestId: s.currentRequestId === requestId ? null : s.currentRequestId,
        turns: s.turns.map((t) =>
          t.id === requestId ? { ...t, error: friendlyLLMError(message), done: true } : t
        )
      }))
    } finally {
      dispose?.()
    }
  },

  clear: () => set({ turns: [] }),

  stop: () => {
    const { currentRequestId } = get()
    if (!currentRequestId) return
    // 真正中断后端生成
    void window.api.agent.stop(currentRequestId)
    set((s) => ({
      running: false,
      currentRequestId: null,
      turns: s.turns.map((t) =>
        t.id === currentRequestId && t.role === 'assistant'
          ? { ...t, done: true }
          : t
      )
    }))
  }
}))
