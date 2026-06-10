import { useEffect, useRef, useCallback, useState } from 'react'
import { useProjectStore } from '../stores/project'
import { useAgentStore } from '../stores/agent'
import { ContextMenu, type MenuItem } from './ContextMenu'

export function Editor(): React.ReactElement {
  const chapter = useProjectStore((s) => s.currentChapter)
  const content = useProjectStore((s) => s.currentContent)
  const setContent = useProjectStore((s) => s.setContent)
  const isWritingMode = useProjectStore((s) => s.isWritingMode)
  const send = useAgentStore((s) => s.send)
  const appendToChapter = useProjectStore((s) => s.appendToChapter)

  const titleRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null)

  // 暴露选区给 Agent
  useEffect(() => {
    const w = window as unknown as { __mwGetSelection?: () => string }
    w.__mwGetSelection = () => {
      const ta = textareaRef.current
      if (!ta) return ''
      return ta.value.substring(ta.selectionStart, ta.selectionEnd)
    }
  })

  // 标题修改 → 保存到后端
  const handleTitleBlur = useCallback(async () => {
    if (!chapter || !titleRef.current) return
    const newTitle = titleRef.current.value.trim()
    if (newTitle && newTitle !== chapter.title) {
      const updated = await window.api.chapter.rename({ id: chapter.id, title: newTitle })
      if (updated) {
        useProjectStore.setState((s) => ({
          currentChapter: updated,
          chapters: s.chapters.map((c) => c.id === updated.id ? updated : c)
        }))
      }
    }
  }, [chapter])

  // Agent 流式写入
  useEffect(() => {
    const w = window as unknown as { __mwAppendText?: (text: string) => void }
    w.__mwAppendText = (text: string) => {
      useProjectStore.getState().appendToChapter(text)
    }
  }, [])

  if (!chapter) {
    return (
      <main className="flex flex-1 items-center justify-center bg-surface-900 text-gray-500">
        请选择或新建一个章节
      </main>
    )
  }

  return (
    <main className={`flex-1 flex flex-col overflow-hidden bg-surface-900 ${isWritingMode ? 'items-center' : ''}`}>
      <div
        className={`flex-1 overflow-y-auto ${isWritingMode ? 'w-full max-w-[680px]' : 'w-full'}`}
        onClick={(e) => {
          // 点击空白区域时聚焦到正文
          if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'DIV') {
            textareaRef.current?.focus()
          }
        }}
      >
        <div className="px-8 pt-10 pb-60">
          {/* ===== 章节标题（可编辑） ===== */}
          <input
            ref={titleRef}
            key={chapter.id + '-title'}
            className="w-full bg-transparent text-gray-200 outline-none placeholder-gray-500 border-none"
            defaultValue={chapter.title + ' '}
            placeholder="输入章节标题"
            onFocus={(e) => {
              const len = e.currentTarget.value.length
              e.currentTarget.setSelectionRange(len, len)
            }}
            onBlur={(e) => {
              const val = e.currentTarget.value.trimEnd()
              e.currentTarget.value = val + ' '
              if (chapter && val && val !== chapter.title) {
                void window.api.chapter.rename({ id: chapter.id, title: val }).then((updated) => {
                  if (updated) {
                    useProjectStore.setState((s) => ({
                      currentChapter: updated,
                      chapters: s.chapters.map((c) => c.id === updated.id ? updated : c)
                    }))
                  }
                })
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                textareaRef.current?.focus()
              }
            }}
            style={{
              fontFamily: "'LXGW WenKai', 'Noto Serif SC', 'PingFang SC', serif",
              fontSize: '28px',
              lineHeight: '1.4'
            }}
          />

          {/* ===== 正文（可编辑） ===== */}
          <textarea
            ref={textareaRef}
            key={chapter.id + '-body'}
            className="mt-4 w-full min-h-[60vh] resize-none bg-transparent text-base leading-8 text-gray-300 outline-none placeholder-gray-500 border-none"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="请输入正文"
            onContextMenu={(e) => {
              const ta = textareaRef.current
              if (!ta) return
              const selected = ta.value.substring(ta.selectionStart, ta.selectionEnd).trim()
              if (!selected) return // 没选中文字不弹菜单
              e.preventDefault()
              const projectId = useProjectStore.getState().currentProject?.id
              const chapterId = useProjectStore.getState().currentChapter?.id
              setCtxMenu({
                x: e.clientX,
                y: e.clientY,
                items: [
                  { label: '润色', action: () => void send({ input: '润色这段文字', projectId, chapterId, selection: selected }) },
                  { label: '扩写', action: () => void send({ input: '扩写这段文字', projectId, chapterId, selection: selected }) },
                  { label: '缩写', action: () => void send({ input: '缩写这段文字', projectId, chapterId, selection: selected }) },
                  { label: '改写对话', action: () => void send({ input: '改写这段对话，让人物口吻更鲜明', projectId, chapterId, selection: selected }) },
                  { label: '去口水话', action: () => void send({ input: '去除口水话，精炼这段文字', projectId, chapterId, selection: selected }) },
                ]
              })
            }}
            style={{
              fontFamily: "'LXGW WenKai', 'Noto Serif SC', 'PingFang SC', serif",
              fontSize: isWritingMode ? '20px' : '18px',
              lineHeight: isWritingMode ? '2.2' : '2',
              paddingLeft: '2em',
              letterSpacing: '0.07em'
            }}
          />
        </div>
      </div>

      {ctxMenu && (
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxMenu.items} onClose={() => setCtxMenu(null)} />
      )}
    </main>
  )
}
