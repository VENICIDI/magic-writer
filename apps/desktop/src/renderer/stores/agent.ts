import { create } from 'zustand'
import type { AgentType, LLMStreamChunk } from '@magic-writer/shared'

export interface AgentTurn {
  id: string
  role: 'user' | 'assistant'
  content: string
  agentType?: AgentType
  done?: boolean
  error?: string
}

interface AgentState {
  activeAgent: AgentType
  turns: AgentTurn[]
  running: boolean
  listenerInstalled: boolean
  currentRequestId: string | null

  setActiveAgent: (a: AgentType) => void
  ensureListener: () => void
  send: (input: {
    input: string
    projectId?: string
    chapterId?: string
    selection?: string
    /** 是否把流式文本实时写入编辑器 */
    insertIntoEditor?: boolean
    onDelta?: (delta: string) => void
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

  setActiveAgent: (a) => set({ activeAgent: a }),

  ensureListener: () => {
    if (get().listenerInstalled) return
    window.api.agent.onStreamChunk((chunk: LLMStreamChunk) => {
      set((s) => {
        const turns = [...s.turns]
        const last = turns[turns.length - 1]
        if (!last || last.role !== 'assistant' || last.id !== chunk.requestId) {
          return s
        }
        last.content += chunk.delta
        if (chunk.done) {
          last.done = true
          if (chunk.error) last.error = chunk.error
        }
        return { turns, running: chunk.done ? false : s.running }
      })
    })
    set({ listenerInstalled: true })
  },

  send: async ({ input, projectId, chapterId, selection, insertIntoEditor, onDelta }) => {
    get().ensureListener()
    const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const agentType = get().activeAgent

    set((s) => ({
      turns: [
        ...s.turns,
        { id: requestId + '-u', role: 'user', content: input },
        { id: requestId, role: 'assistant', content: '', agentType }
      ],
      running: true,
      currentRequestId: requestId
    }))

    // 若需要实时写入编辑器，额外挂一个临时监听
    let dispose: (() => void) | undefined
    if (insertIntoEditor || onDelta) {
      dispose = window.api.agent.onStreamChunk((chunk) => {
        if (chunk.requestId !== requestId) return
        if (chunk.delta) onDelta?.(chunk.delta)
        if (chunk.done) dispose?.()
      })
    }

    try {
      await window.api.agent.run({
        requestId,
        projectId: projectId ?? '',
        agentType,
        input,
        selection,
        chapterId
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      set((s) => ({
        running: false,
        turns: s.turns.map((t) =>
          t.id === requestId ? { ...t, error: message, done: true } : t
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
    // 标记当前 turn 为完成
    set((s) => ({
      running: false,
      currentRequestId: null,
      turns: s.turns.map((t) =>
        t.id === currentRequestId && t.role === 'assistant'
          ? { ...t, done: true, content: t.content + '\n\n[已中断]' }
          : t
      )
    }))
  }
}))
