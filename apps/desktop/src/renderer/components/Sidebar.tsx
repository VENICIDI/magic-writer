import { useMemo, useState, useCallback } from 'react'
import { useProjectStore } from '../stores/project'
import { WorldPanel } from './WorldPanel'
import { ForeshadowingPanel } from './ForeshadowingPanel'
import { OutlinePanel } from './OutlinePanel'
import { EntityForgePanel } from './EntityForgePanel'
import { ContextMenu, type MenuItem } from './ContextMenu'
import { InputModal } from './InputModal'
import { IconBook, IconGlobe, IconTarget, IconOutline, IconWand } from './Icons'

type InnerTab = 'chapters' | 'world' | 'foreshadowing' | 'outline' | 'forge'

interface MenuState { x: number; y: number; items: MenuItem[] }

interface ModalState {
  title: string
  placeholder?: string
  defaultValue?: string
  onConfirm: (value: string) => void
}

export function Sidebar(): React.ReactElement {
  const project = useProjectStore((s) => s.currentProject)
  const volumes = useProjectStore((s) => s.volumes)
  const chapters = useProjectStore((s) => s.chapters)
  const currentChapter = useProjectStore((s) => s.currentChapter)
  const openChapter = useProjectStore((s) => s.openChapter)

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [activeTab, setActiveTab] = useState<InnerTab>('chapters')
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [modal, setModal] = useState<ModalState | null>(null)

  const totalWords = useMemo(() => chapters.reduce((n, c) => n + c.wordCount, 0), [chapters])
  const toggle = (id: string): void => setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }))

  // ===== 新建卷 =====
  const handleCreateVolume = useCallback(() => {
    if (!project) return
    const numToHan = ['一','二','三','四','五','六','七','八','九','十',
      '十一','十二','十三','十四','十五','十六','十七','十八','十九','二十']
    const next = volumes.length + 1
    const hanNum = numToHan[next - 1] || String(next)
    setModal({
      title: '新建卷',
      placeholder: '输入卷名称',
      defaultValue: `第${hanNum}卷`,
      onConfirm: async (title) => {
        const vol = await window.api.volume.create({ projectId: project.id, title })
        useProjectStore.setState((s) => ({ volumes: [...s.volumes, vol] }))
      }
    })
  }, [project, volumes.length])

  // ===== 新建章节 =====
  const handleCreateChapter = useCallback(async (volumeId: string) => {
    if (!project) return
    const volChapters = chapters.filter((c) => c.volumeId === volumeId)
    const title = `第${volChapters.length + 1}章`
    const ch = await window.api.chapter.create({ projectId: project.id, volumeId, title })
    useProjectStore.setState((s) => ({ chapters: [...s.chapters, ch] }))
    void useProjectStore.getState().openChapter(ch.id)
  }, [project, chapters])

  // ===== 重命名卷 =====
  const handleRenameVolume = useCallback((vid: string, currentTitle: string) => {
    setModal({
      title: '重命名卷',
      placeholder: '输入新名称',
      defaultValue: currentTitle,
      onConfirm: async (title) => {
        await window.api.volume.rename({ id: vid, title })
        useProjectStore.setState((s) => ({
          volumes: s.volumes.map((v) => v.id === vid ? { ...v, title } : v)
        }))
      }
    })
  }, [])

  // ===== 删除卷 =====
  const handleDeleteVolume = useCallback(async (vid: string) => {
    await window.api.volume.delete(vid)
    if (project) {
      const d = await window.api.chapter.list(project.id)
      useProjectStore.setState({ volumes: d.volumes, chapters: d.chapters })
      // 如果当前章节被删了（属于被删的卷），清空或切换
      const cur = useProjectStore.getState().currentChapter
      if (cur && !d.chapters.find((c) => c.id === cur.id)) {
        if (d.chapters.length > 0) {
          void useProjectStore.getState().openChapter(d.chapters[0].id)
        } else {
          useProjectStore.setState({ currentChapter: null, currentContent: '', saved: true })
        }
      }
    }
  }, [project])

  // ===== 删除章节 =====
  const handleDeleteChapter = useCallback(async (cid: string) => {
    await window.api.chapter.delete(cid)
    if (project) {
      const d = await window.api.chapter.list(project.id)
      useProjectStore.setState({ volumes: d.volumes, chapters: d.chapters })
      if (currentChapter?.id === cid) {
        if (d.chapters.length > 0) {
          void useProjectStore.getState().openChapter(d.chapters[0].id)
        } else {
          useProjectStore.setState({ currentChapter: null, currentContent: '', saved: true })
        }
      }
    }
  }, [project, currentChapter])

  // ===== 右键菜单 =====
  const onNavCtx = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    if (!project) return
    setMenu({ x: e.clientX, y: e.clientY, items: [
      { label: '新建卷', action: () => handleCreateVolume() }
    ] })
  }, [project, handleCreateVolume])

  const onVolCtx = useCallback((e: React.MouseEvent, vid: string, vt: string) => {
    e.preventDefault(); e.stopPropagation()
    setMenu({ x: e.clientX, y: e.clientY, items: [
      { label: '重命名', action: () => handleRenameVolume(vid, vt) },
      { label: '新建章节', action: () => handleCreateChapter(vid) },
      { label: '删除卷', action: () => void handleDeleteVolume(vid), danger: true }
    ] })
  }, [handleRenameVolume, handleCreateChapter, handleDeleteVolume])

  const onChCtx = useCallback((e: React.MouseEvent, vid: string, cid: string, _ct: string) => {
    e.preventDefault(); e.stopPropagation()
    setMenu({ x: e.clientX, y: e.clientY, items: [
      { label: '新建章节', action: () => handleCreateChapter(vid) },
      { label: '删除章节', action: () => void handleDeleteChapter(cid), danger: true }
    ] })
  }, [handleCreateChapter, handleDeleteChapter])

  const tabs: Array<{ id: InnerTab; icon: React.ReactNode; title: string }> = [
    { id: 'chapters', icon: <IconBook size={20} />, title: '章节' },
    { id: 'outline', icon: <IconOutline size={20} />, title: '大纲' },
    { id: 'world', icon: <IconGlobe size={20} />, title: '世界观' },
    { id: 'foreshadowing', icon: <IconTarget size={20} />, title: '伏笔' },
    { id: 'forge', icon: <IconWand size={20} />, title: 'AI 百宝箱' }
  ]

  return (
    <div className="flex shrink-0 border-r border-surface-600">
      {/* ===== 纵向 Tab Bar ===== */}
      <div className="flex w-12 flex-col items-center border-r border-surface-600 bg-surface-900 py-2 gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
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
      <div className="flex w-52 flex-col bg-surface-800">
        {activeTab === 'world' ? (
          <WorldPanel />
        ) : activeTab === 'foreshadowing' ? (
          <ForeshadowingPanel />
        ) : activeTab === 'outline' ? (
          <OutlinePanel />
        ) : activeTab === 'forge' ? (
          <EntityForgePanel />
        ) : (
          <>
            {/* 作品信息 */}
            <div className="border-b border-surface-600 px-3 py-2">
              <div className="truncate text-sm font-medium text-gray-300">{project?.title}</div>
              <div className="text-sm text-gray-500 mt-0.5">{totalWords.toLocaleString()} 字</div>
            </div>

            {/* 章节树 */}
            <nav className="flex-1 overflow-y-auto py-1 px-1.5 text-xs" onContextMenu={onNavCtx}>
              {volumes.map((v) => {
                const vc = chapters.filter((c) => c.volumeId === v.id)
                const col = collapsed[v.id]
                return (
                  <div key={v.id} className="mb-0.5">
                    <button
                      className="flex w-full items-center gap-1 rounded px-2 py-1 text-left text-sm font-medium text-gray-400 transition-colors hover:bg-surface-600 hover:text-gray-200"
                      onClick={() => toggle(v.id)}
                      onContextMenu={(e) => onVolCtx(e, v.id, v.title)}
                    >
                      <span className="text-sm text-gray-600">{col ? '▶' : '▼'}</span>
                      <span className="truncate">{v.title}</span>
                      <span className="ml-auto text-[11px] text-gray-600">{vc.length}</span>
                    </button>
                    {!col && (
                      <div className="ml-2 mt-0.5 space-y-px">
                        {vc.map((c) => (
                          <button
                            key={c.id}
                            className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm transition-colors ${
                              currentChapter?.id === c.id
                                ? 'bg-accent-15 text-accent-light'
                                : 'text-gray-400 hover:bg-surface-600 hover:text-gray-200'
                            }`}
                            onClick={() => void openChapter(c.id)}
                            onContextMenu={(e) => onChCtx(e, v.id, c.id, c.title)}
                          >
                            <span className="truncate">{c.title}</span>
                            <span className="ml-1 shrink-0 text-[11px] text-gray-600">{c.wordCount}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
              {volumes.length === 0 && <p className="px-2 py-4 text-sm text-gray-500">右键新建卷</p>}
            </nav>
          </>
        )}
      </div>

      {/* 右键菜单 */}
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />}

      {/* 输入弹窗 */}
      <InputModal
        open={!!modal}
        title={modal?.title ?? ''}
        placeholder={modal?.placeholder}
        defaultValue={modal?.defaultValue}
        onConfirm={(value) => {
          modal?.onConfirm(value)
          setModal(null)
        }}
        onCancel={() => setModal(null)}
      />
    </div>
  )
}
