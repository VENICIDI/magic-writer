import { useEffect, useRef, useState } from 'react'
import type { AgentType } from '@magic-writer/shared'
import { useAgentStore } from '../stores/agent'
import { useProjectStore } from '../stores/project'
import { OutlinePanel } from './OutlinePanel'
import { ReviewReport } from './ReviewReport'
import { IconWriter, IconPolish, IconReview, IconOutline } from './Icons'

const AGENT_TYPES: Array<{ id: AgentType; label: string; icon: React.ReactNode }> = [
  { id: 'writer', label: '续写', icon: <IconWriter size={14} /> },
  { id: 'polish', label: '润色', icon: <IconPolish size={14} /> },
  { id: 'review', label: '审校', icon: <IconReview size={14} /> },
  { id: 'outline', label: '大纲', icon: <IconOutline size={14} /> }
]

export function AgentPanel(): React.ReactElement {
  const activeAgent = useAgentStore((s) => s.activeAgent)
  const setActiveAgent = useAgentStore((s) => s.setActiveAgent)
  const turns = useAgentStore((s) => s.turns)
  const running = useAgentStore((s) => s.running)
  const send = useAgentStore((s) => s.send)

  const currentProject = useProjectStore((s) => s.currentProject)
  const currentChapter = useProjectStore((s) => s.currentChapter)
  const appendToChapter = useProjectStore((s) => s.appendToChapter)

  const [input, setInput] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [turns])

  const onSend = async (): Promise<void> => {
    const text = input.trim() || '续写下一段'
    setInput('')
    // 获取 Monaco 选区（如果有）
    const getSelection = (window as unknown as { __mwGetSelection?: () => string }).__mwGetSelection
    const selection = getSelection?.() || undefined
    await send({
      input: text,
      projectId: currentProject?.id,
      chapterId: currentChapter?.id,
      selection,
      insertIntoEditor: activeAgent === 'writer',
      onDelta: (delta) => {
        if (activeAgent === 'writer') appendToChapter(delta)
      }
    })
  }

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-surface-600 bg-surface-800">
      <div className="flex gap-1 border-b border-surface-600 p-1">
        {AGENT_TYPES.map((agent) => (
          <button
            key={agent.id}
            className={`flex-1 rounded py-1.5 text-xs transition-colors ${
              activeAgent === agent.id
                ? 'bg-accent-20 text-accent-light'
                : 'text-gray-500 hover:text-gray-300'
            }`}
            onClick={() => setActiveAgent(agent.id)}
          >
            <span className="block mb-0.5 flex justify-center">{agent.icon}</span>
            {agent.label}
          </button>
        ))}
      </div>

      {/* 专属面板：大纲 / 审校 */}
      {activeAgent === 'outline' ? (
        <OutlinePanel />
      ) : activeAgent === 'review' ? (
        <ReviewReport />
      ) : (
        <>
          {/* 通用对话流 */}

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-3 text-sm">
        {turns.length === 0 && (
          <div className="py-8 text-center text-xs text-gray-500">
            选中文字或按 ⌘Enter 开始对话
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
              {t.role === 'user' ? '我' : t.agentType ?? 'assistant'}
            </div>
            <div className="whitespace-pre-wrap">
              {t.content}
              {!t.done && t.role === 'assistant' && (
                <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-accent-light" />
              )}
            </div>
            {t.error && (
              <div className="mt-1 text-xs text-red-400">错误：{t.error}</div>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-surface-600 p-3">
        <textarea
          className="w-full resize-none rounded-lg bg-surface-700 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 outline-none focus:ring-1 focus:ring-accent/50"
          rows={3}
          placeholder={
            activeAgent === 'writer'
              ? '留空直接续写本章，或输入指令…'
              : '输入指令…'
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault()
              void onSend()
            }
          }}
          disabled={running}
        />
        <button
          className="mt-2 w-full rounded-lg bg-accent py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-80 disabled:cursor-not-allowed disabled:bg-surface-600 disabled:text-gray-400"
          onClick={onSend}
          disabled={running || !currentChapter}
        >
          {running ? '生成中…' : '发送  ⌘⏎'}
        </button>
      </div>
        </>
      )}
    </aside>
  )
}
