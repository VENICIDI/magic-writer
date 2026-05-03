import { useState } from 'react'
import { useAgentStore } from '../stores/agent'
import { useProjectStore } from '../stores/project'
import { IconReview, IconCheck, IconLightbulb } from './Icons'

interface ReviewIssue {
  type: string
  severity: 'high' | 'mid' | 'low'
  chapterId?: string
  description: string
  suggestion: string
}

export function ReviewReport(): React.ReactElement {
  const turns = useAgentStore((s) => s.turns)
  const send = useAgentStore((s) => s.send)
  const running = useAgentStore((s) => s.running)
  const setActiveAgent = useAgentStore((s) => s.setActiveAgent)
  const currentProject = useProjectStore((s) => s.currentProject)
  const currentChapter = useProjectStore((s) => s.currentChapter)
  const openChapter = useProjectStore((s) => s.openChapter)

  const [issues, setIssues] = useState<ReviewIssue[]>([])
  const [parsed, setParsed] = useState(false)

  function parseLatestReview(): void {
    const reviewTurns = turns.filter(
      (t) => t.role === 'assistant' && t.agentType === 'review' && t.done
    )
    const latest = reviewTurns[reviewTurns.length - 1]
    if (!latest) return

    try {
      let jsonStr = latest.content
      const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (match) jsonStr = match[1]
      const data = JSON.parse(jsonStr.trim())
      if (Array.isArray(data)) {
        setIssues(data as ReviewIssue[])
        setParsed(true)
      }
    } catch {
      // 非 JSON，显示原始文本
      setIssues([])
      setParsed(true)
    }
  }

  async function handleReview(): Promise<void> {
    setActiveAgent('review')
    await send({
      input: '审校本章，检查人设一致性、时间线冲突和伏笔问题',
      projectId: currentProject?.id,
      chapterId: currentChapter?.id
    })
    setTimeout(parseLatestReview, 500)
  }

  const highIssues = issues.filter((i) => i.severity === 'high')
  const midIssues = issues.filter((i) => i.severity === 'mid')
  const lowIssues = issues.filter((i) => i.severity === 'low')

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-surface-600 p-3">
        <h3 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-1.5"><IconReview size={14} /> 审校报告</h3>
        <button
          className="w-full rounded-lg bg-amber-600/80 py-1.5 text-xs text-white hover:bg-amber-600 disabled:opacity-50"
          onClick={handleReview}
          disabled={running || !currentChapter}
        >
          {running ? '审校中…' : '审校本章'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {!parsed && issues.length === 0 ? (
          <div className="text-center text-xs text-gray-500 py-8">
            {turns.some((t) => t.agentType === 'review' && t.done) ? (
              <button
                className="text-accent-light hover:underline"
                onClick={parseLatestReview}
              >
                点击解析审校结果
              </button>
            ) : (
              '点击上方按钮开始审校'
            )}
          </div>
        ) : issues.length === 0 && parsed ? (
          <div className="text-center py-8">
            <div className="mb-2 flex justify-center text-green-400"><IconCheck size={32} /></div>
            <div className="text-xs text-gray-400">未发现明显问题</div>
          </div>
        ) : (
          <div className="space-y-3">
            {highIssues.length > 0 && (
              <IssueGroup title="🔴 高优" issues={highIssues} onJump={openChapter} />
            )}
            {midIssues.length > 0 && (
              <IssueGroup title="🟡 中优" issues={midIssues} onJump={openChapter} />
            )}
            {lowIssues.length > 0 && (
              <IssueGroup title="🟢 低优" issues={lowIssues} onJump={openChapter} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function IssueGroup({
  title,
  issues,
  onJump
}: {
  title: string
  issues: ReviewIssue[]
  onJump: (chapterId: string) => Promise<void>
}): React.ReactElement {
  return (
    <div>
      <div className="text-xs font-semibold text-gray-400 mb-1.5">
        {title} ({issues.length})
      </div>
      <div className="space-y-1.5">
        {issues.map((issue, i) => (
          <div key={i} className="rounded-lg border border-surface-600 bg-surface-700 p-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="text-[13px] text-gray-300 leading-4">
                  {issue.description}
                </div>
                {issue.suggestion && (
                  <div className="mt-1 text-[12px] text-gray-500 leading-3.5 flex items-start gap-1">
                    <IconLightbulb size={10} className="shrink-0 mt-0.5" /> {issue.suggestion}
                  </div>
                )}
              </div>
              {issue.chapterId && (
                <button
                  className="shrink-0 rounded px-1.5 py-0.5 text-[13px] text-accent-light hover:bg-surface-500"
                  onClick={() => void onJump(issue.chapterId!)}
                >
                  跳转
                </button>
              )}
            </div>
            <div className="mt-1 text-[13px] text-gray-600">
              类型：{issue.type}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
