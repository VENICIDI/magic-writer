import MonacoEditor, { type OnMount } from '@monaco-editor/react'
import { useEffect, useRef } from 'react'
import { useProjectStore } from '../stores/project'

export function Editor(): React.ReactElement {
  const chapter = useProjectStore((s) => s.currentChapter)
  const content = useProjectStore((s) => s.currentContent)
  const setContent = useProjectStore((s) => s.setContent)
  const isWritingMode = useProjectStore((s) => s.isWritingMode)

  const editorRef = useRef<Parameters<OnMount>[0] | null>(null)

  const onMount: OnMount = (editor) => {
    editorRef.current = editor
  }

  // 暴露 editor 给外部（Agent 流式插入用）
  useEffect(() => {
    const w = window as unknown as {
      __mwEditor?: typeof editorRef.current
      __mwGetSelection?: () => string
    }
    w.__mwEditor = editorRef.current
    w.__mwGetSelection = () => {
      const editor = editorRef.current
      if (!editor) return ''
      const sel = editor.getSelection()
      if (!sel) return ''
      return editor.getModel()?.getValueInRange(sel) ?? ''
    }
  })

  if (!chapter) {
    return (
      <main className="flex flex-1 items-center justify-center bg-surface-900 text-gray-600">
        请选择或新建一个章节
      </main>
    )
  }

  return (
    <main className={`flex-1 overflow-hidden bg-surface-900 ${isWritingMode ? 'flex items-center justify-center' : ''}`}>
      <div className={isWritingMode ? 'w-full max-w-[680px] h-full' : 'w-full h-full'}>
        <MonacoEditor
          height="100%"
          language="markdown"
          theme="vs-dark"
          path={chapter.id}
          value={content}
          onChange={(v) => setContent(v ?? '')}
          onMount={onMount}
          options={{
            fontSize: isWritingMode ? 18 : 16,
            lineHeight: isWritingMode ? 32 : 28,
            fontFamily: "'LXGW WenKai', 'Noto Serif SC', 'PingFang SC', serif",
            wordWrap: 'on',
            minimap: { enabled: false },
            lineNumbers: 'off',
            glyphMargin: false,
            folding: false,
            renderLineHighlight: 'none',
            scrollBeyondLastLine: true,
            padding: { top: isWritingMode ? 80 : 24, bottom: isWritingMode ? 300 : 160 },
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            smoothScrolling: true,
            overviewRulerBorder: false,
            hideCursorInOverviewRuler: true,
            scrollbar: {
              vertical: 'auto',
              horizontal: 'hidden',
              verticalScrollbarSize: 6
            }
          }}
        />
      </div>
    </main>
  )
}
