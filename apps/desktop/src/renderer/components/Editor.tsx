import { useEffect, useRef, useCallback } from 'react'
import { useProjectStore } from '../stores/project'

export function Editor(): React.ReactElement {
  const chapter = useProjectStore((s) => s.currentChapter)
  const content = useProjectStore((s) => s.currentContent)
  const setContent = useProjectStore((s) => s.setContent)
  const isWritingMode = useProjectStore((s) => s.isWritingMode)

  const titleRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
            className="w-full bg-transparent text-xl font-bold text-gray-200 outline-none placeholder-gray-500 border-none"
            defaultValue={chapter.title + ' '}
            placeholder="输入章节标题"
            onFocus={(e) => {
              const len = e.currentTarget.value.length
              e.currentTarget.setSelectionRange(len, len)
            }}
            onBlur={(e) => {
              // 保存时去掉末尾空格
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
              fontFamily: "'LXGW WenKai', 'Noto Serif SC', 'PingFang SC', serif"
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
            style={{
              fontFamily: "'LXGW WenKai', 'Noto Serif SC', 'PingFang SC', serif",
              fontSize: isWritingMode ? '18px' : '16px',
              lineHeight: isWritingMode ? '2.2' : '2'
            }}
          />
        </div>
      </div>
    </main>
  )
}
