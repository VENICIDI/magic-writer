import { useState } from 'react'
import { useAgentStore } from '../stores/agent'
import { useProjectStore } from '../stores/project'
import { IconOutline, IconWand } from './Icons'

/**
 * OutlineAgent 返回的 JSON 结构
 */
interface OutlineData {
  acts: Array<{
    title: string
    volumes: Array<{
      title: string
      chapters: Array<{
        title: string
        summary: string
      }>
    }>
  }>
}

export function OutlinePanel(): React.ReactElement {
  const turns = useAgentStore((s) => s.turns)
  const send = useAgentStore((s) => s.send)
  const running = useAgentStore((s) => s.running)
  const currentProject = useProjectStore((s) => s.currentProject)
  const setActiveAgent = useAgentStore((s) => s.setActiveAgent)

  const [outline, setOutline] = useState<OutlineData | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [inputText, setInputText] = useState('')

  // 尝试从最新的 outline agent 回复中解析 JSON
  function parseLatestOutline(): void {
    const outlineTurns = turns.filter(
      (t) => t.role === 'assistant' && t.agentType === 'outline' && t.done
    )
    const latest = outlineTurns[outlineTurns.length - 1]
    if (!latest) return

    try {
      // 尝试提取 JSON（可能包裹在 markdown 代码块中）
      let jsonStr = latest.content
      const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (match) jsonStr = match[1]
      const data = JSON.parse(jsonStr.trim()) as OutlineData
      if (data.acts) setOutline(data)
    } catch {
      // 解析失败，显示原始文本
    }
  }

  async function handleGenerate(): Promise<void> {
    setActiveAgent('outline')
    await send({
      input: inputText.trim() || '根据当前项目设定，生成三幕式大纲',
      projectId: currentProject?.id
    })
    // 生成完后尝试解析
    setTimeout(parseLatestOutline, 500)
  }

  const toggleCollapse = (key: string): void => {
    setCollapsed((c) => ({ ...c, [key]: !c[key] }))
  }

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="border-b border-surface-600 p-3">
        <h3 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-1.5"><IconOutline size={14} /> 大纲生成</h3>
        <textarea
          className="w-full resize-none rounded-lg bg-surface-700 px-3 py-2 text-xs text-gray-200 placeholder-gray-500 outline-none focus:ring-1 focus:ring-accent/50"
          rows={2}
          placeholder="输入题材、主角、卖点等信息，AI 将生成三幕式大纲…"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
        />
        <button
          className="mt-2 w-full rounded-lg bg-accent py-1.5 text-xs text-white hover:bg-accent-80 disabled:opacity-50"
          onClick={handleGenerate}
          disabled={running}
        >
          {running ? '生成中…' : '生成大纲'}
        </button>
      </div>

      {/* 大纲树 */}
      <div className="flex-1 overflow-y-auto p-3">
        {!outline ? (
          <div className="text-center text-xs text-gray-500 py-8">
            {turns.some((t) => t.agentType === 'outline' && t.done) ? (
              <button
                className="text-accent-light hover:underline"
                onClick={parseLatestOutline}
              >
                点击解析最新大纲
              </button>
            ) : (
              '尚未生成大纲，请输入设定后点击生成'
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {outline.acts.map((act, ai) => (
              <div key={ai} className="rounded border border-surface-600 bg-surface-700">
                <button
                  className="w-full px-3 py-2 text-left text-xs font-semibold text-gray-200 hover:bg-surface-600"
                  onClick={() => toggleCollapse(`act-${ai}`)}
                >
                  {collapsed[`act-${ai}`] ? '▶' : '▼'} 第{ai + 1}幕：{act.title}
                </button>
                {!collapsed[`act-${ai}`] && (
                  <div className="px-3 pb-2 space-y-1.5">
                    {act.volumes.map((vol, vi) => (
                      <div key={vi} className="ml-2">
                        <button
                          className="w-full text-left text-sm font-medium text-gray-300 hover:text-accent-light py-0.5"
                          onClick={() => toggleCollapse(`vol-${ai}-${vi}`)}
                        >
                          {collapsed[`vol-${ai}-${vi}`] ? '▶' : '▼'} {vol.title}
                        </button>
                        {!collapsed[`vol-${ai}-${vi}`] && (
                          <div className="ml-3 space-y-1 mt-1">
                            {vol.chapters.map((ch, ci) => (
                              <div
                                key={ci}
                                className="rounded bg-surface-800 px-2 py-1.5"
                              >
                                <div className="text-sm text-gray-300 font-medium">
                                  {ch.title}
                                </div>
                                <div className="text-sm text-gray-500 mt-0.5 leading-4">
                                  {ch.summary}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
