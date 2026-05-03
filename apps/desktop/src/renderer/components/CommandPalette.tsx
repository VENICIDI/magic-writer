import { useEffect, useRef, useState, useMemo } from 'react'
import { useProjectStore } from '../stores/project'
import { useAgentStore } from '../stores/agent'

interface Command {
  id: string
  label: string
  shortcut?: string
  action: () => void
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

export function CommandPalette({ open, onClose }: CommandPaletteProps): React.ReactElement | null {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const saveCurrent = useProjectStore((s) => s.saveCurrent)
  const toggleSidebar = useProjectStore((s) => s.toggleSidebar)
  const toggleAgentPanel = useProjectStore((s) => s.toggleAgentPanel)
  const toggleWritingMode = useProjectStore((s) => s.toggleWritingMode)
  const setActiveAgent = useAgentStore((s) => s.setActiveAgent)

  const commands: Command[] = useMemo(
    () => [
      { id: 'save', label: '保存当前章节', shortcut: '⌘S', action: () => { void saveCurrent() } },
      { id: 'write', label: '续写下一段', shortcut: '⌘Enter', action: () => { setActiveAgent('writer') } },
      { id: 'polish', label: '润色选区', shortcut: '⌘L', action: () => { setActiveAgent('polish') } },
      { id: 'review', label: '审校本章', action: () => { setActiveAgent('review') } },
      { id: 'outline', label: '生成大纲', action: () => { setActiveAgent('outline') } },
      { id: 'toggle-sidebar', label: '切换左侧栏', shortcut: '⌘B', action: toggleSidebar },
      { id: 'toggle-agent', label: '切换 Agent 面板', shortcut: '⌘J', action: toggleAgentPanel },
      { id: 'writing-mode', label: '写作模式', shortcut: '⌘⇧F', action: toggleWritingMode },
      { id: 'new-chapter', label: '新建章节', action: () => { /* TODO */ } },
    ],
    [saveCurrent, toggleSidebar, toggleAgentPanel, toggleWritingMode, setActiveAgent]
  )

  const filtered = useMemo(() => {
    if (!query.trim()) return commands
    const q = query.toLowerCase()
    return commands.filter(
      (c) => c.label.toLowerCase().includes(q) || c.id.includes(q)
    )
  }, [query, commands])

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    setSelectedIndex(0)
  }, [filtered.length])

  if (!open) return null

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const cmd = filtered[selectedIndex]
      if (cmd) {
        cmd.action()
        onClose()
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      onClick={onClose}
    >
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/50" />

      {/* 面板 */}
      <div
        className="relative w-full max-w-[560px] rounded-xl border border-surface-600 bg-surface-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* 搜索框 */}
        <div className="border-b border-surface-600 p-3">
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-transparent text-sm text-gray-200 placeholder-gray-500 outline-none"
            placeholder="输入命令..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* 结果列表 */}
        <div className="max-h-[300px] overflow-y-auto p-1">
          {filtered.length === 0 && (
            <div className="px-3 py-4 text-center text-xs text-gray-500">
              无匹配命令
            </div>
          )}
          {filtered.map((cmd, i) => (
            <button
              key={cmd.id}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                i === selectedIndex
                  ? 'bg-accent-20 text-accent-light'
                  : 'text-gray-300 hover:bg-surface-600'
              }`}
              onClick={() => {
                cmd.action()
                onClose()
              }}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <span>{cmd.label}</span>
              {cmd.shortcut && (
                <span className="ml-2 text-xs text-gray-500">{cmd.shortcut}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
