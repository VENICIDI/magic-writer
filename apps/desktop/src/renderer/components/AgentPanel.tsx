import { useEffect, useRef, useState } from 'react'
import type { AgentType } from '@magic-writer/shared'
import { useAgentStore, type EditorWriteMode } from '../stores/agent'
import { useProjectStore } from '../stores/project'
import {
  IconWriter,
  IconPolish,
  IconOutline,
  IconReview,
  IconGlobe,
  IconLightbulb,
  IconX
} from './Icons'

type IconComp = (props: { className?: string; size?: number }) => React.ReactElement

/** 结果去向：写入正文，或仅在对话区显示 */
type OutputTarget = 'editor' | 'chat'

interface AgentMode {
  type: AgentType
  label: string
  Icon: IconComp
  /** 一句话说明这个模式是做什么的 */
  summary: string
  /** 结果去向 */
  output: OutputTarget
  /** 行为提示：结果会怎样落到正文/对话区 */
  behavior: string
  /** 是否必须先在正文中选中文字 */
  needsSelection: boolean
  /** 空态可点击的示例指令（点击填入输入框） */
  examples: string[]
}

const AGENT_MODES: AgentMode[] = [
  {
    type: 'writer',
    label: '续写',
    Icon: IconWriter,
    summary: '顺着上文往下写新的正文段落。',
    output: 'editor',
    behavior: '生成内容会插入到正文光标处',
    needsSelection: false,
    examples: ['顺着上文续写下一段', '推进当前情节，制造一个转折', '写一段环境描写烘托气氛']
  },
  {
    type: 'polish',
    label: '润色',
    Icon: IconPolish,
    summary: '改写你选中的文字，让它更通顺、更有文采。',
    output: 'editor',
    behavior: '会用润色结果替换正文中选中的文字',
    needsSelection: true,
    examples: ['润色选中文字，更流畅自然', '让这段更有画面感', '调整语气，更冷峻克制']
  },
  {
    type: 'outline',
    label: '大纲',
    Icon: IconOutline,
    summary: '梳理或生成剧情大纲、后续走向。',
    output: 'chat',
    behavior: '结果只显示在对话区，不改动正文',
    needsSelection: false,
    examples: ['为这一章列一个分场大纲', '给我三个后续剧情走向', '把当前情节扩成三幕结构']
  },
  {
    type: 'review',
    label: '审校',
    Icon: IconReview,
    summary: '检查剧情、人设、时间线与伏笔是否前后一致。',
    output: 'chat',
    behavior: '结果只显示在对话区，不改动正文',
    needsSelection: false,
    examples: ['检查这章剧情和人设是否前后一致', '找出可能的时间线矛盾', '指出还没回收的伏笔']
  },
  {
    type: 'world',
    label: '世界观',
    Icon: IconGlobe,
    summary: '梳理人物、设定与世界观相关信息。',
    output: 'chat',
    behavior: '结果只显示在对话区，不改动正文',
    needsSelection: false,
    examples: ['梳理目前出场的人物及关系', '总结当前的世界观设定', '为主角设计一段背景故事']
  }
]

const MODE_BY_TYPE: Record<AgentType, AgentMode> = AGENT_MODES.reduce(
  (acc, m) => {
    acc[m.type] = m
    return acc
  },
  {} as Record<AgentType, AgentMode>
)

/** 按 Agent 类型与是否有选区，决定如何把结果写入正文 */
function resolveEditorMode(type: AgentType, hasSelection: boolean): EditorWriteMode | undefined {
  if (type === 'writer') return 'cursor'
  // 润色仅在有选区时替换选区；无选区由发送按钮拦截，不会走到这里
  if (type === 'polish') return hasSelection ? 'replaceSelection' : undefined
  // 大纲/审校/世界观属于分析类，只在对话区显示，不写入正文
  return undefined
}

export function AgentPanel(): React.ReactElement {
  const turns = useAgentStore((s) => s.turns)
  const running = useAgentStore((s) => s.running)
  const send = useAgentStore((s) => s.send)
  const stop = useAgentStore((s) => s.stop)
  const clear = useAgentStore((s) => s.clear)
  const activeAgent = useAgentStore((s) => s.activeAgent)
  const setActiveAgent = useAgentStore((s) => s.setActiveAgent)
  const selectedText = useAgentStore((s) => s.selectedText)

  const currentProject = useProjectStore((s) => s.currentProject)
  const currentChapter = useProjectStore((s) => s.currentChapter)

  const [input, setInput] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const mode = MODE_BY_TYPE[activeAgent]
  const selection = selectedText.trim()
  const hasSelection = selection.length > 0
  const missingSelection = mode.needsSelection && !hasSelection
  const canSend = !!currentChapter && !!input.trim() && !missingSelection

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [turns])

  const onSend = async (): Promise<void> => {
    const text = input.trim()
    if (!text || !canSend) return
    setInput('')
    await send({
      input: text,
      projectId: currentProject?.id,
      chapterId: currentChapter?.id,
      selection: hasSelection ? selectedText : undefined,
      editorMode: resolveEditorMode(activeAgent, hasSelection)
    })
  }

  const fillExample = (text: string): void => {
    setInput(text)
    inputRef.current?.focus()
  }

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-surface-600 bg-surface-800">
      {/* ===== 标题 + 清空 ===== */}
      <div className="flex items-center justify-between border-b border-surface-600 px-3 py-2">
        <span className="text-sm font-medium text-gray-300">AI 助手</span>
        {turns.length > 0 && (
          <button
            className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-gray-500 transition-colors hover:bg-surface-700 hover:text-gray-300 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={clear}
            disabled={running}
            title="清空当前对话"
          >
            <IconX size={13} />
            清空
          </button>
        )}
      </div>

      {/* ===== 模式切换 ===== */}
      <div className="border-b border-surface-600 px-3 py-2.5">
        <div className="flex flex-wrap gap-1">
          {AGENT_MODES.map((m) => {
            const active = activeAgent === m.type
            return (
              <button
                key={m.type}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
                  active
                    ? 'bg-accent text-on-accent'
                    : 'bg-surface-700 text-gray-400 hover:text-gray-200'
                }`}
                onClick={() => setActiveAgent(m.type)}
                title={`${m.summary}（${m.behavior}）`}
              >
                <m.Icon size={13} />
                {m.label}
              </button>
            )
          })}
        </div>

        {/* 当前模式说明：讲清楚「干什么」+「结果去哪」 */}
        <div className="mt-2.5 rounded-lg border border-surface-600 bg-surface-900 px-2.5 py-2">
          <p className="text-xs leading-5 text-gray-400">{mode.summary}</p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                mode.output === 'editor'
                  ? 'bg-accent-15 text-accent-light'
                  : 'bg-surface-700 text-gray-400'
              }`}
            >
              {mode.output === 'editor' ? '写入正文' : '仅对话区'}
            </span>
            <span className="text-[11px] leading-4 text-gray-500">{mode.behavior}</span>
          </div>
        </div>
      </div>

      {/* ===== 对话流 / 空态引导 ===== */}
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-3 text-sm">
        {turns.length === 0 ? (
          <div className="px-1 py-4">
            <div className="mb-2 flex items-center gap-1.5 text-xs text-gray-500">
              <IconLightbulb size={13} className="text-accent-light" />
              试试这些「{mode.label}」指令
            </div>
            <div className="flex flex-col gap-1.5">
              {mode.examples.map((ex) => (
                <button
                  key={ex}
                  className="rounded-lg border border-surface-600 bg-surface-700 px-2.5 py-1.5 text-left text-xs leading-5 text-gray-300 transition-colors hover:border-accent/40 hover:text-gray-100"
                  onClick={() => fillExample(ex)}
                >
                  {ex}
                </button>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-5 text-gray-600">
              点击示例填入输入框，或直接输入你的指令。⌘⏎ 发送。
            </p>
          </div>
        ) : (
          turns.map((t) => (
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
          ))
        )}
      </div>

      {/* ===== 输入区 ===== */}
      <div className="border-t border-surface-600 p-3">
        {/* 选区感知提示：润色等需选区的模式 */}
        {mode.needsSelection &&
          (hasSelection ? (
            <div className="mb-2 flex items-center gap-1.5 text-[11px] text-accent-light">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              已选中 {selection.length} 字，将替换为{mode.label}结果
            </div>
          ) : (
            <div className="mb-2 text-[11px] leading-4 text-amber-400">
              请先在正文中选中要{mode.label}的文字
            </div>
          ))}

        <textarea
          ref={inputRef}
          className="w-full resize-none rounded-lg bg-surface-700 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 outline-none focus:ring-1 focus:ring-accent/50"
          rows={3}
          placeholder={
            mode.needsSelection
              ? '在正文选中文字，再描述想怎么改…'
              : '输入指令，⌘⏎ 发送…'
          }
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
            disabled={!canSend}
          >
            发送  ⌘⏎
          </button>
        )}
        {!currentChapter && (
          <p className="mt-1.5 text-[11px] text-gray-600">请先选择或新建一个章节</p>
        )}
      </div>
    </aside>
  )
}
