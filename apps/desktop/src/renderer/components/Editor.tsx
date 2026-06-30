import { useEffect, useLayoutEffect, useRef, useCallback, useState } from 'react'
import { useProjectStore, consumePendingCaret } from '../stores/project'
import { useAgentStore } from '../stores/agent'
import type { EditorWriter, EditorWriteMode } from '../stores/agent'
import { ContextMenu, type MenuItem } from './ContextMenu'

export function Editor(): React.ReactElement {
  const chapter = useProjectStore((s) => s.currentChapter)
  const content = useProjectStore((s) => s.currentContent)
  const setContent = useProjectStore((s) => s.setContent)
  const isWritingMode = useProjectStore((s) => s.isWritingMode)
  const send = useAgentStore((s) => s.send)

  const titleRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // AI 流式写入锚点：begin 时记录，write 时推进
  const anchorRef = useRef<{ start: number; end: number } | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null)

  // 暴露选区给 Agent（用于把选中文字作为上下文）
  useEffect(() => {
    const w = window as unknown as { __mwGetSelection?: () => string }
    w.__mwGetSelection = () => {
      const ta = textareaRef.current
      if (!ta) return ''
      return ta.value.substring(ta.selectionStart, ta.selectionEnd)
    }
  })

  // 注册编辑器写入控制器：光标插入 / 选区替换 + 流式推进
  useEffect(() => {
    const writer: EditorWriter = {
      begin: (mode: EditorWriteMode) => {
        const ta = textareaRef.current
        const store = useProjectStore.getState()
        // 整段 AI 写入作为一个可撤销步骤
        store.beginAgentWrite()
        if (!ta) {
          // 没有 textarea 时退化为在文末插入
          const len = store.currentContent.length
          anchorRef.current = { start: len, end: len }
          return
        }
        anchorRef.current =
          mode === 'replaceSelection'
            ? { start: ta.selectionStart, end: ta.selectionEnd }
            : { start: ta.selectionStart, end: ta.selectionStart }
      },
      write: (delta: string) => {
        const a = anchorRef.current
        if (!a) return
        const cur = useProjectStore.getState().currentContent
        const start = Math.min(a.start, cur.length)
        const end = Math.min(a.end, cur.length)
        const next = cur.slice(0, start) + delta + cur.slice(end)
        const caret = start + delta.length
        anchorRef.current = { start: caret, end: caret }
        useProjectStore.getState().applyAgentEdit(next, caret)
      },
      end: () => {
        anchorRef.current = null
        useProjectStore.getState().endAgentWrite()
      }
    }
    ;(window as unknown as { __mwEditor?: EditorWriter }).__mwEditor = writer
    return () => {
      delete (window as unknown as { __mwEditor?: EditorWriter }).__mwEditor
    }
  }, [])

  // 程序化写入/撤销后，把光标移动到目标位置并跟随滚动
  useLayoutEffect(() => {
    const caret = consumePendingCaret()
    if (caret == null) return
    const ta = textareaRef.current
    if (!ta) return
    const active = document.activeElement
    const editingElsewhere =
      active && active !== ta && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')
    const pos = Math.min(caret, ta.value.length)
    // 不抢占用户正在编辑的其它输入框焦点；否则聚焦以触发滚动跟随
    if (!editingElsewhere) ta.focus()
    ta.setSelectionRange(pos, pos)
  }, [content])

  // 标题修改 → 保存到后端
  const handleTitleBlur = useCallback(async () => {
    if (!chapter || !titleRef.current) return
    const newTitle = titleRef.current.value.trim()
    if (newTitle && newTitle !== chapter.title) {
      const updated = await window.api.chapter.rename({ id: chapter.id, title: newTitle })
      if (updated) {
        useProjectStore.setState((s) => ({
          currentChapter: updated,
          chapters: s.chapters.map((c) => (c.id === updated.id ? updated : c))
        }))
      }
    }
  }, [chapter])

  if (!chapter) {
    return (
      <main className="flex flex-1 items-center justify-center bg-surface-900 text-gray-500">
        请选择或新建一个章节
      </main>
    )
  }

  const projectId = chapter.projectId
  const chapterId = chapter.id

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
            defaultValue={chapter.title}
            placeholder="输入章节标题"
            onBlur={handleTitleBlur}
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
            onKeyDown={(e) => {
              // 自建撤销/重做（受控 textarea 的原生 undo 不可靠）
              if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault()
                if (e.shiftKey) useProjectStore.getState().redo()
                else useProjectStore.getState().undo()
              }
            }}
            onContextMenu={(e) => {
              const ta = textareaRef.current
              if (!ta) return
              const selected = ta.value.substring(ta.selectionStart, ta.selectionEnd).trim()
              if (!selected) return // 没选中文字不弹菜单
              e.preventDefault()
              const polish = (input: string): void => {
                void send({
                  input,
                  projectId,
                  chapterId,
                  selection: selected,
                  agentType: 'polish',
                  editorMode: 'replaceSelection'
                })
              }
              setCtxMenu({
                x: e.clientX,
                y: e.clientY,
                items: [
                  { label: '润色', action: () => polish('润色这段文字') },
                  { label: '扩写', action: () => polish('扩写这段文字') },
                  { label: '缩写', action: () => polish('缩写这段文字') },
                  { label: '改写对话', action: () => polish('改写这段对话，让人物口吻更鲜明') },
                  { label: '去口水话', action: () => polish('去除口水话，精炼这段文字') }
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
