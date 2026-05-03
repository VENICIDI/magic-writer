import { useMemo, useState, useCallback } from 'react'
import { useProjectStore } from '../stores/project'
import { WorldPanel } from './WorldPanel'
import { ForeshadowingPanel } from './ForeshadowingPanel'
import { ContextMenu, type MenuItem } from './ContextMenu'
import { IconBook, IconGlobe, IconTarget } from './Icons'

type InnerTab = 'chapters' | 'world' | 'foreshadowing'

interface MenuState { x: number; y: number; items: MenuItem[] }

export function Sidebar(): React.ReactElement {
  const project = useProjectStore((s) => s.currentProject)
  const volumes = useProjectStore((s) => s.volumes)
  const chapters = useProjectStore((s) => s.chapters)
  const currentChapter = useProjectStore((s) => s.currentChapter)
  const openChapter = useProjectStore((s) => s.openChapter)

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [activeTab, setActiveTab] = useState<InnerTab>('chapters')
  const [menu, setMenu] = useState<MenuState | null>(null)

  const totalWords = useMemo(() => chapters.reduce((n, c) => n + c.wordCount, 0), [chapters])
  const toggle = (id: string): void => setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }))

  // ===== CRUD =====
  const handleCreateVolume = useCallback(async () => {
    if (!project) return
    const title = window.prompt('新建卷名称', `卷${volumes.length + 1}`)
    if (!title) return
    const vol = await window.api.volume.create({ projectId: project.id, title })
    useProjectStore.setState((s) => ({ volumes: [...s.volumes, vol] }))
  }, [project, volumes.length])

  const handleCreateChapter = useCallback(async (volumeId: string) => {
    if (!project) return
    const title = window.prompt('新建章节名称', '新章节')
    if (!title) return
    const ch = await window.api.chapter.create({ projectId: project.id, volumeId, title })
    useProjectStore.setState((s) => ({ chapters: [...s.chapters, ch] }))
    void useProjectStore.getState().openChapter(ch.id)
  }, [project])

  const handleDeleteVolume = useCallback(async (vid: string, vTitle: string) => {
    if (!window.confirm(`确定删除「${vTitle}」及其下所有章节？`)) return
    await window.api.volume.delete(vid)
    if (project) {
      const d = await window.api.chapter.list(project.id)
      useProjectStore.setState({ volumes: d.volumes, chapters: d.chapters })
    }
  }, [project])

  const handleDeleteChapter = useCallback(async (cid: string, cTitle: string) => {
    if (!window.confirm(`确定删除「${cTitle}」？`)) return
    await window.api.chapter.delete(cid)
    if (project) {
      const d = await window.api.chapter.list(project.id)
      useProjectStore.setState({ volumes: d.volumes, chapters: d.chapters })
      if (currentChapter?.id === cid && d.chapters.length > 0)
        void useProjectStore.getState().openChapter(d.chapters[0].id)
    }
  }, [project, currentChapter])

  // ===== 右键菜单 =====
  const onNavCtx = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    if (!project) return
    setMenu({ x: e.clientX, y: e.clientY, items: [{ label: '新建卷', action: () => void handleCreateVolume() }] })
  }, [project, handleCreateVolume])

  const onVolCtx = useCallback((e: React.MouseEvent, vid: string, vt: string) => {
    e.preventDefault(); e.stopPropagation()
    setMenu({ x: e.clientX, y: e.clientY, items: [
      { label: '新建章节', action: () => void handleCreateChapter(vid) },
      { label: '删除卷', action: () => void handleDeleteVolume(vid, vt), danger: true }
    ] })
  }, [handleCreateChapter, handleDeleteVolume])

  const onChCtx = useCallback((e: React.MouseEvent, vid: string, cid: string, ct: string) => {
    e.preventDefault(); e.stopPropagation()
    setMenu({ x: e.clientX, y: e.clientY, items: [
      { label: '新建章节', action: () => void handleCreateChapter(vid) },
      { label: '删除章节', action: () => void handleDeleteChapter(cid, ct), danger: true }
    ] })
  }, [handleCreateChapter, handleDeleteChapter])

  const tabs: Array<{ id: InnerTab; icon: React.ReactNode; title: string }> = [
    { id: 'chapters', icon: <IconBook size={13} />, title: '章节' },
    { id: 'world', icon: <IconGlobe size={13} />, title: '世界观' },
    { id: 'foreshadowing', icon: <IconTarget size={13} />, title: '伏笔' }
  ]

  return (
    <div className="flex shrink-0 border-r border-surface-600">
      {/* ===== 纵向 Tab Bar ===== */}
      <div className="flex w-10 flex-col items-center border-r border-surface-600 bg-surface-900 py-2 gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
              activeTab === t.id
                ? 'bg-accent-20 text-accent-light'
                : 'text-gray-500 hover:text-gray-300 hover:bg-surface-700'
            }`}
            onClick={() => setActiveTab(t.id)}
            title={t.title}
          >
            {t.icon}
          </button>
        ))}
      </div>

      {/* ===== 内容面板 ===== */}
      <div className="flex w-48 flex-col bg-surface-800">
      {activeTab === 'world' ? (
        <WorldPanel />
      ) : activeTab === 'foreshadowing' ? (
        <ForeshadowingPanel />
      ) : (
        <>
          {/* 作品信息 */}
          <div className="border-b border-surface-600 px-3 py-2">
            <div className="truncate text-[13px] font-medium text-gray-300">{project?.title}</div>
            <div className="text-[13px] text-gray-500 mt-0.5">{totalWords.toLocaleString()} 字</div>
          </div>

          {/* 章节树 */}
          <nav className="flex-1 overflow-y-auto py-1 px-1.5 text-xs" onContextMenu={onNavCtx}>
            {volumes.map((v) => {
              const vc = chapters.filter((c) => c.volumeId === v.id)
              const col = collapsed[v.id]
              return (
                <div key={v.id} className="mb-0.5">
                  <button
                    className="flex w-full items-center gap-1 rounded px-2 py-1 text-left text-[13px] font-medium text-gray-400 transition-colors hover:bg-surface-600 hover:text-gray-200"
                    onClick={() => toggle(v.id)}
                    onContextMenu={(e) => onVolCtx(e, v.id, v.title)}
                  >
                    <span className="text-[13px] text-gray-600">{col ? '▶' : '▼'}</span>
                    <span className="truncate">{v.title}</span>
                    <span className="ml-auto text-[8px] text-gray-600">{vc.length}</span>
                  </button>
                  {!col && (
                    <div className="ml-2 mt-0.5 space-y-px">
                      {vc.map((c) => (
                        <button
                          key={c.id}
                          className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-[13px] transition-colors ${
                            currentChapter?.id === c.id
                              ? 'bg-accent-15 text-accent-light'
                              : 'text-gray-400 hover:bg-surface-600 hover:text-gray-200'
                          }`}
                          onClick={() => void openChapter(c.id)}
                          onContextMenu={(e) => onChCtx(e, v.id, c.id, c.title)}
                        >
                          <span className="truncate">{c.title}</span>
                          <span className="ml-1 shrink-0 text-[13px] text-gray-600">{c.wordCount}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            {volumes.length === 0 && <p className="px-2 py-4 text-[12px] text-gray-500">右键新建卷</p>}
          </nav>
        </>
      )}
      </div>

      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />}
    </div>
  )
}
