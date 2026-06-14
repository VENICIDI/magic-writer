import { useEffect, useState } from 'react'
import { LibraryView } from './components/LibraryView'
import { Sidebar } from './components/Sidebar'
import { Editor } from './components/Editor'
import { AgentPanel } from './components/AgentPanel'
import { StatusBar } from './components/StatusBar'
import { CommandPalette } from './components/CommandPalette'
import { SettingsPanel } from './components/SettingsPanel'
import { WorldviewAnalyzerView } from './components/WorldviewAnalyzerView'
import { useProjectStore } from './stores/project'
import { useAgentStore } from './stores/agent'
import { useTheme } from './hooks/useTheme'

function App(): React.ReactElement {
  const bootstrap = useProjectStore((s) => s.bootstrap)
  const saveCurrent = useProjectStore((s) => s.saveCurrent)
  const toggleSidebar = useProjectStore((s) => s.toggleSidebar)
  const toggleAgentPanel = useProjectStore((s) => s.toggleAgentPanel)
  const toggleWritingMode = useProjectStore((s) => s.toggleWritingMode)
  const isWritingMode = useProjectStore((s) => s.isWritingMode)
  const sidebarVisible = useProjectStore((s) => s.sidebarVisible)
  const agentPanelVisible = useProjectStore((s) => s.agentPanelVisible)
  const currentProject = useProjectStore((s) => s.currentProject)
  const ensureListener = useAgentStore((s) => s.ensureListener)
  const { theme, setTheme } = useTheme()

  const [activePage, setActivePage] = useState<'library' | 'workspace' | 'worldview'>('library')
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    void bootstrap()
    ensureListener()
  }, [bootstrap, ensureListener])

  // 全局快捷键
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      if (e.key === 's') {
        e.preventDefault()
        void saveCurrent()
      } else if (e.key === 'b') {
        e.preventDefault()
        toggleSidebar()
      } else if (e.key === 'j') {
        e.preventDefault()
        toggleAgentPanel()
      } else if (e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(true)
      } else if (e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        toggleWritingMode()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saveCurrent, toggleSidebar, toggleAgentPanel, toggleWritingMode])

  return (
    <div className="flex h-screen flex-col bg-surface-900 text-gray-200">
      {/* ===== 顶部 Tab Bar（模仿参考图：作品库 tab + 当前作品 tab）===== */}
      <div className="titlebar-drag flex h-10 shrink-0 items-center border-b border-surface-600 bg-surface-800">
        {/* macOS traffic lights 占位 */}
        <div className="w-[72px] shrink-0" />

        {/* Tab: 作品库 */}
        <button
          className={`titlebar-no-drag flex items-center gap-1.5 px-3 h-full text-sm border-r border-surface-600 transition-colors ${
            activePage === 'library'
              ? 'bg-surface-900 text-gray-200'
              : 'text-gray-500 hover:text-gray-300'
          }`}
          onClick={() => setActivePage('library')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          </svg>
          作品库
        </button>

        {/* Tab: 世界观分析 */}
        <button
          className={`titlebar-no-drag flex items-center gap-1.5 px-3 h-full text-sm border-r border-surface-600 transition-colors ${
            activePage === 'worldview'
              ? 'bg-surface-900 text-gray-200'
              : 'text-gray-500 hover:text-gray-300'
          }`}
          onClick={() => setActivePage('worldview')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
            <path d="M2 12h20" />
          </svg>
          世界观分析
        </button>

        {/* Tab: 当前作品（仅有打开项目时显示） */}
        {currentProject && (
          <button
            className={`titlebar-no-drag flex items-center gap-1.5 px-3 h-full text-sm border-r border-surface-600 transition-colors ${
              activePage === 'workspace'
                ? 'bg-surface-900 text-gray-200'
                : 'text-gray-500 hover:text-gray-300'
            }`}
            onClick={() => setActivePage('workspace')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
            </svg>
            <span className="max-w-[120px] truncate">{currentProject.title}</span>
            <span
              className="titlebar-no-drag ml-1 rounded-sm p-0.5 text-gray-600 hover:text-gray-300 hover:bg-surface-600"
              onClick={(e) => { e.stopPropagation(); setActivePage('library') }}
            >
              ×
            </span>
          </button>
        )}

        {/* 占据剩余空间（可拖拽） */}
        <div className="flex-1" />

        {/* 右侧操作按钮 */}
        <div className="titlebar-no-drag flex items-center gap-1 pr-3">
          <button
            className={`rounded p-1 transition-colors hover:bg-surface-700 ${agentPanelVisible ? 'text-accent-light' : 'text-gray-500 hover:text-gray-300'}`}
            onClick={toggleAgentPanel}
            title={agentPanelVisible ? '收起 AI 面板' : '展开 AI 面板'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M15 3v18" />
            </svg>
          </button>
          <button
            className="rounded p-1 text-gray-500 transition-colors hover:text-gray-300 hover:bg-surface-700"
            onClick={() => setSettingsOpen(true)}
            title="设置"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
      </div>

      {/* ===== 主区域 ===== */}
      <div className="flex flex-1 overflow-hidden">
        {activePage === 'library' ? (
          <LibraryView onEnterProject={() => setActivePage('workspace')} />
        ) : activePage === 'worldview' ? (
          <WorldviewAnalyzerView />
        ) : (
          <div className="flex flex-1 overflow-hidden">
            {!isWritingMode && sidebarVisible && <Sidebar />}
            <div className="flex flex-1 flex-col overflow-hidden">
              <Editor />
              <StatusBar />
            </div>
            {!isWritingMode && agentPanelVisible && <AgentPanel />}
          </div>
        )}
      </div>

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        onThemeChange={setTheme}
      />
    </div>
  )
}

export default App
