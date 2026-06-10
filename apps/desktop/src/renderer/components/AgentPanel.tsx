import { useEffect, useRef, useState } from 'react'
import { useAgentStore } from '../stores/agent'
import { useProjectStore } from '../stores/project'

export function AgentPanel(): React.ReactElement {
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
      insertIntoEditor: true,
      onDelta: (delta) => {
        appendToChapter(delta)
      }
    })
  }

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-surface-600 bg-surface-800">
      {/* 标题 */}
      <div className="flex items-center border-b border-surface-600 px-3 py-2">
        <span className="text-sm font-medium text-gray-300">AI 助手</span>
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
              <div className="mt-1 text-xs text-red-400">错误：{t.error}</div>
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
              void onSend()
            }
          }}
          disabled={running}
        />
        <button
          className="mt-2 w-full rounded-lg bg-accent py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-80 disabled:cursor-not-allowed disabled:bg-surface-600 disabled:text-gray-400"
          onClick={onSend}
          disabled={running || !currentChapter || !input.trim()}
        >
          {running ? '生成中…' : '发送  ⌘⏎'}
        </button>
      </div>
    </aside>
  )
}
