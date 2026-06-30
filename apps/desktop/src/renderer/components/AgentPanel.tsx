import { useEffect, useRef, useState } from 'react'
import type { AgentType } from '@magic-writer/shared'
import { useAgentStore, type EditorWriteMode } from '../stores/agent'
import { useProjectStore } from '../stores/project'

const AGENT_TABS: Array<{ type: AgentType; label: string }> = [
  { type: 'writer', label: '续写' },
  { type: 'polish', label: '润色' },
  { type: 'outline', label: '大纲' },
  { type: 'review', label: '审校' },
  { type: 'world', label: '世界观' }
]

/** 按 Agent 类型与是否有选区，决定如何把结果写入正文 */
function resolveEditorMode(type: AgentType, hasSelection: boolean): EditorWriteMode | undefined {
  if (type === 'writer') return 'cursor'
  if (type === 'polish') return hasSelection ? 'replaceSelection' : 'cursor'
  // 大纲/审校/世界观属于分析类，只在对话区显示，不写入正文
  return undefined
}

export function AgentPanel(): React.ReactElement {
  const turns = useAgentStore((s) => s.turns)
  const running = useAgentStore((s) => s.running)
  const send = useAgentStore((s) => s.send)
  const stop = useAgentStore((s) => s.stop)
  const activeAgent = useAgentStore((s) => s.activeAgent)
  const setActiveAgent = useAgentStore((s) => s.setActiveAgent)

  const currentProject = useProjectStore((s) => s.currentProject)
  const currentChapter = useProjectStore((s) => s.currentChapter)

  const [input, setInput] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [turns])

  const onSend = async (): Promise<void> => {
    const text = input.trim()
    if (!text) return
    setInput('')
    const getSelection = (window as unknown as { __mwGetSelection?: () => string }).__mwGetSelection
    const selection = getSelection?.() || undefined
    await send({
      input: text,
      projectId: currentProject?.id,
      chapterId: currentChapter?.id,
      selection,
      editorMode: resolveEditorMode(activeAgent, !!selection)
    })
  }

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-surface-600 bg-surface-800">
      {/* 标题 + Agent 类型切换 */}
      <div className="border-b border-surface-600 px-3 py-2">
        <span className="text-sm font-medium text-gray-300">AI 助手</span>
        <div className="mt-2 flex flex-wrap gap-1">
          {AGENT_TABS.map((tab) => (
            <button
              key={tab.type}
              className={`rounded-md px-2 py-1 text-xs transition-colors ${
                activeAgent === tab.type
                  ? 'bg-accent text-on-accent'
                  : 'bg-surface-700 text-gray-400 hover:text-gray-200'
              }`}
              onClick={() => setActiveAgent(tab.type)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 对话流 */}
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-3 text-sm">
        {turns.length === 0 && (
          <div className="py-8 text-center text-xs text-gray-500">
            输入指令开始对话
          </div>
        )}
        {turns.map((t) => (
          <div
            key={t.id}
            className={`rounded-lg px-3 py-2 text-sm leading-6 ${
              t.role === 'user'
                ? 'bg-surface-600 text-gray-200'
                : 'bg-surface-700 text-gray-300'
            }`}
          >
            <div className="mb-1 text-sm uppercase tracking-wide text-gray-500">
              {t.role === 'user' ? '我' : 'AI'}
            </div>
            <div className="whitespace-pre-wrap">
              {t.content}
              {!t.done && t.role === 'assistant' && (
                <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-accent-light" />
              )}
            </div>
            {t.error && (
              <div className="mt-1 whitespace-pre-wrap text-xs text-red-400">错误：{t.error}</div>
            )}
          </div>
        ))}
      </div>

      {/* 输入区 */}
      <div className="border-t border-surface-600 p-3">
        <textarea
          className="w-full resize-none rounded-lg bg-surface-700 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 outline-none focus:ring-1 focus:ring-accent/50"
          rows={3}
          placeholder="输入指令，如：续写下一段 / 润色选中文字 / 帮我改写这段对话…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault()
              if (!running) void onSend()
            }
          }}
        />
        {running ? (
          <button
            className="mt-2 w-full rounded-lg border border-red-500/50 py-1.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
            onClick={stop}
          >
            停止生成
          </button>
        ) : (
          <button
            className="mt-2 w-full rounded-lg bg-accent py-1.5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-80 disabled:cursor-not-allowed disabled:bg-surface-600 disabled:text-gray-400"
            onClick={onSend}
            disabled={!currentChapter || !input.trim()}
          >
            发送  ⌘⏎
          </button>
        )}
      </div>
    </aside>
  )
}
