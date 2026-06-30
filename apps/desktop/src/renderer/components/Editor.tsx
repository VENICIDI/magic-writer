import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import MonacoEditor, { type BeforeMount, type OnChange, type OnMount } from '@monaco-editor/react'
import type * as MonacoNS from 'monaco-editor'
import './../lib/monaco-setup'
import { useProjectStore } from '../stores/project'
import { useAgentStore } from '../stores/agent'
import type { EditorWriter, EditorWriteMode } from '../stores/agent'

type MonacoApi = typeof MonacoNS
type CodeEditor = MonacoNS.editor.IStandaloneCodeEditor

/** 在 position 处插入 text 后，返回文本末尾的新位置（支持多行 delta） */
function advancePosition(monaco: MonacoApi, start: MonacoNS.Position, text: string): MonacoNS.Position {
  const lines = text.split('\n')
  if (lines.length === 1) {
    return new monaco.Position(start.lineNumber, start.column + lines[0].length)
  }
  const lastLen = lines[lines.length - 1].length
  return new monaco.Position(start.lineNumber + lines.length - 1, lastLen + 1)
}

/** 注册纯正文写作主题（深/浅各一套，背景与正文区底色一致） */
function defineThemes(monaco: MonacoApi): void {
  monaco.editor.defineTheme('mw-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#050507',
      'editor.foreground': '#d4d2ce',
      'editorCursor.foreground': '#00d992',
      'editor.selectionBackground': '#00d99230',
      'editor.lineHighlightBackground': '#00000000',
      'editor.lineHighlightBorder': '#00000000',
      'editorIndentGuide.background': '#00000000',
      'scrollbarSlider.background': '#4f4b4966',
      'scrollbarSlider.hoverBackground': '#4f4b4999',
      'scrollbarSlider.activeBackground': '#4f4b49cc'
    }
  })
  monaco.editor.defineTheme('mw-light', {
    base: 'vs',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#1f1f23',
      'editorCursor.foreground': '#00b87d',
      'editor.selectionBackground': '#00b87d30',
      'editor.lineHighlightBackground': '#00000000',
      'editor.lineHighlightBorder': '#00000000',
      'editorIndentGuide.background': '#00000000'
    }
  })
}

export function Editor(): React.ReactElement {
  const chapter = useProjectStore((s) => s.currentChapter)
  const setContent = useProjectStore((s) => s.setContent)
  const isWritingMode = useProjectStore((s) => s.isWritingMode)
  const send = useAgentStore((s) => s.send)

  const titleRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<CodeEditor | null>(null)
  const monacoRef = useRef<MonacoApi | null>(null)
  // AI 流式写入锚点：begin 记录写入范围，write 逐段推进
  const anchorRef = useRef<MonacoNS.Range | null>(null)
  // 章节上下文用 ref 暴露给 Monaco 回调（addAction / writer 注册时闭包安全）
  const chapterRef = useRef(chapter)
  chapterRef.current = chapter

  const [editorTheme, setEditorTheme] = useState<'mw-dark' | 'mw-light'>(() =>
    document.documentElement.getAttribute('data-theme') === 'light' ? 'mw-light' : 'mw-dark'
  )

  // 跟随全局主题切换（data-theme）刷新编辑器主题
  useEffect(() => {
    const obs = new MutationObserver(() => {
      setEditorTheme(
        document.documentElement.getAttribute('data-theme') === 'light' ? 'mw-light' : 'mw-dark'
      )
    })
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  // 注册写入控制器与选区读取器（懒读 editorRef，跨章节重挂载仍有效）
  useEffect(() => {
    const win = window as unknown as {
      __mwEditor?: EditorWriter
      __mwGetSelection?: () => string
    }

    const writer: EditorWriter = {
      begin: (mode: EditorWriteMode) => {
        const editor = editorRef.current
        const monaco = monacoRef.current
        const model = editor?.getModel()
        if (!editor || !monaco || !model) {
          anchorRef.current = null
          return
        }
        const sel = editor.getSelection()
        if (mode === 'replaceSelection' && sel && !sel.isEmpty()) {
          anchorRef.current = monaco.Range.fromPositions(sel.getStartPosition(), sel.getEndPosition())
        } else {
          const pos = editor.getPosition() ?? model.getPositionAt(model.getValueLength())
          anchorRef.current = monaco.Range.fromPositions(pos, pos)
        }
        // 整段 AI 生成作为单个可撤销步骤：开始打一个 undo 边界
        editor.pushUndoStop()
        editor.focus()
      },
      write: (delta: string) => {
        const editor = editorRef.current
        const monaco = monacoRef.current
        const range = anchorRef.current
        if (!editor || !monaco || !range) return
        editor.executeEdits('mw-ai-write', [{ range, text: delta, forceMoveMarkers: true }])
        const end = advancePosition(monaco, range.getStartPosition(), delta)
        anchorRef.current = monaco.Range.fromPositions(end, end)
        editor.setPosition(end)
        // 流式过程跟随滚动到写入位置
        editor.revealPositionInCenterIfOutsideViewport(end)
      },
      end: () => {
        // 结束 undo 边界，使本次生成可一步撤销
        editorRef.current?.pushUndoStop()
        anchorRef.current = null
      }
    }

    win.__mwEditor = writer
    win.__mwGetSelection = () => {
      const editor = editorRef.current
      const sel = editor?.getSelection()
      if (!editor || !sel) return ''
      return editor.getModel()?.getValueInRange(sel) ?? ''
    }
    return () => {
      delete win.__mwEditor
      delete win.__mwGetSelection
    }
  }, [])

  const handleBeforeMount: BeforeMount = useCallback((monaco) => {
    defineThemes(monaco)
  }, [])

  const handleMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor
      monacoRef.current = monaco

      // 选区变化实时同步到 agent store，供 AI 助手面板做选区感知（润色等需选区的模式）
      const syncSelection = (): void => {
        const sel = editor.getSelection()
        const text = sel ? editor.getModel()?.getValueInRange(sel) ?? '' : ''
        useAgentStore.getState().setSelectedText(text)
      }
      editor.onDidChangeCursorSelection(syncSelection)
      syncSelection()

      // 右键润色菜单：选中文字后出现「润色/扩写/缩写/改写对话/去口水话」
      const items: Array<{ id: string; label: string; input: string }> = [
        { id: 'mw.polish', label: '润色', input: '润色这段文字' },
        { id: 'mw.expand', label: '扩写', input: '扩写这段文字' },
        { id: 'mw.shorten', label: '缩写', input: '缩写这段文字' },
        { id: 'mw.dialogue', label: '改写对话', input: '改写这段对话，让人物口吻更鲜明' },
        { id: 'mw.dewater', label: '去口水话', input: '去除口水话，精炼这段文字' }
      ]
      items.forEach((item, i) => {
        editor.addAction({
          id: item.id,
          label: item.label,
          contextMenuGroupId: 'mw-ai',
          contextMenuOrder: i,
          // 仅在有选区时出现，等价于旧版「没选中文字不弹菜单」
          precondition: 'editorHasSelection',
          run: (ed) => {
            const sel = ed.getSelection()
            const selected = sel ? ed.getModel()?.getValueInRange(sel).trim() : ''
            if (!selected) return
            const ch = chapterRef.current
            void send({
              input: item.input,
              projectId: ch?.projectId,
              chapterId: ch?.id,
              selection: selected,
              agentType: 'polish',
              editorMode: 'replaceSelection'
            })
          }
        })
      })
    },
    [send]
  )

  const handleChange: OnChange = useCallback(
    (value) => {
      setContent(value ?? '')
    },
    [setContent]
  )

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

  const options = useMemo<MonacoNS.editor.IStandaloneEditorConstructionOptions>(() => {
    const fontSize = isWritingMode ? 20 : 18
    return {
      fontFamily: "'LXGW WenKai', 'Noto Serif SC', 'PingFang SC', serif",
      fontSize,
      lineHeight: isWritingMode ? 2.2 : 2,
      letterSpacing: fontSize * 0.07,
      wordWrap: 'on',
      wrappingStrategy: 'advanced',
      lineNumbers: 'off',
      minimap: { enabled: false },
      folding: false,
      glyphMargin: false,
      lineDecorationsWidth: 0,
      lineNumbersMinChars: 0,
      renderLineHighlight: 'none',
      guides: { indentation: false },
      renderWhitespace: 'none',
      occurrencesHighlight: 'off',
      selectionHighlight: false,
      matchBrackets: 'never',
      links: false,
      quickSuggestions: false,
      suggestOnTriggerCharacters: false,
      overviewRulerLanes: 0,
      overviewRulerBorder: false,
      hideCursorInOverviewRuler: true,
      scrollBeyondLastLine: true,
      cursorBlinking: 'smooth',
      automaticLayout: true,
      padding: { top: 24, bottom: 240 },
      scrollbar: {
        vertical: 'auto',
        horizontal: 'hidden',
        useShadows: false,
        verticalScrollbarSize: 6
      }
    }
  }, [isWritingMode])

  if (!chapter) {
    return (
      <main className="flex flex-1 items-center justify-center bg-surface-900 text-gray-500">
        请选择或新建一个章节
      </main>
    )
  }

  // 不订阅 currentContent，避免每次输入/流式 delta 触发整个 Editor 重渲染；
  // 章节切换由 currentChapter 触发渲染，此处取最新内容作为初始值。
  const initialContent = useProjectStore.getState().currentContent

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-surface-900">
      <div
        className={`flex h-full min-h-0 w-full flex-col ${
          isWritingMode ? 'mx-auto max-w-[720px]' : ''
        }`}
      >
        {/* ===== 章节标题（可编辑，普通 input） ===== */}
        <div className="shrink-0 px-8 pt-8">
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
                editorRef.current?.focus()
              }
            }}
            style={{
              fontFamily: "'LXGW WenKai', 'Noto Serif SC', 'PingFang SC', serif",
              fontSize: '28px',
              lineHeight: '1.4'
            }}
          />
        </div>

        {/* ===== 正文（Monaco） ===== */}
        <div className="min-h-0 flex-1 px-6 pt-2">
          <MonacoEditor
            key={chapter.id}
            defaultValue={initialContent}
            language="plaintext"
            theme={editorTheme}
            options={options}
            beforeMount={handleBeforeMount}
            onMount={handleMount}
            onChange={handleChange}
            loading={<div className="px-8 pt-8 text-gray-500">正在加载编辑器…</div>}
          />
        </div>
      </div>
    </main>
  )
}
