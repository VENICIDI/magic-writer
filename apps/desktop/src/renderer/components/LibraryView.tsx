/**
 * LibraryView — 作品库主页
 *
 * 模仿作家助手的主界面：
 * - 顶部：新建/导入操作栏
 * - 主体：作品卡片网格
 */
import { useState } from 'react'
import { useProjectStore } from '../stores/project'
import { IconPlus, IconX } from './Icons'
import { CreateProjectModal } from './CreateProjectModal'

interface LibraryViewProps {
  onEnterProject: (projectId: string) => void
}

export function LibraryView({ onEnterProject }: LibraryViewProps): React.ReactElement {
  const projects = useProjectStore((s) => s.projects)
  const openProject = useProjectStore((s) => s.openProject)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  async function handleCreate(data: { title: string; genre: string; logline: string }): Promise<void> {
    const newProject = await window.api.project.create(data)
    await window.api.volume.create({ projectId: newProject.id, title: '卷一' })
    const { projects: all } = await window.api.project.list()
    useProjectStore.setState({ projects: all })
    await openProject(newProject.id)
    onEnterProject(newProject.id)
  }

  async function handleDelete(id: string, title: string, e: React.MouseEvent): Promise<void> {
    e.stopPropagation()
    const ok = window.confirm(`确定删除作品「${title}」及全部内容？此操作不可撤销。`)
    if (!ok) return
    await window.api.project.delete(id)
    const { projects: all } = await window.api.project.list()
    useProjectStore.setState({ projects: all })
    const current = useProjectStore.getState().currentProject
    if (current?.id === id) {
      useProjectStore.setState({ currentProject: null, volumes: [], chapters: [], currentChapter: null, currentContent: '' })
    }
  }

  async function handleOpen(id: string): Promise<void> {
    await openProject(id)
    onEnterProject(id)
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-surface-900">
      {/* ===== 作品列表标题 ===== */}
      <div className="flex items-center justify-between px-6 py-3">
        <h2 className="text-sm font-medium text-gray-300">
          全部作品
          <span className="ml-1.5 text-xs text-gray-500">({projects.length})</span>
        </h2>
      </div>

      {/* ===== 作品卡片网格 ===== */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
          {projects.map((p) => (
            <div
              key={p.id}
              className="group relative cursor-pointer rounded-xl border border-surface-600 bg-surface-800 transition-all hover:border-accent/40 hover:shadow-lg hover:shadow-accent/5"
              onClick={() => void handleOpen(p.id)}
              onMouseEnter={() => setHoveredId(p.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {/* 封面区域 */}
              <div className="flex h-44 items-center justify-center rounded-t-xl bg-gradient-to-br from-surface-700 to-surface-800">
                <div className="text-center px-3">
                  <div className="text-base font-bold text-gray-300 leading-tight">
                    {p.title}
                  </div>
                  {p.genre && (
                    <div className="mt-2 inline-block rounded-full bg-accent-15 px-2 py-0.5 text-[13px] text-accent-light">
                      {p.genre}
                    </div>
                  )}
                </div>
              </div>

              {/* 信息区域 */}
              <div className="px-3 py-2.5">
                <div className="truncate text-[13px] font-medium text-gray-300">
                  {p.title}
                </div>
                {p.logline && (
                  <div className="mt-0.5 truncate text-[13px] text-gray-500">
                    {p.logline}
                  </div>
                )}
              </div>

              {/* 删除按钮（hover 出现） */}
              {hoveredId === p.id && (
                <button
                  className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-surface-900/80 text-gray-400 transition-colors hover:bg-red-500/20 hover:text-red-400"
                  onClick={(e) => void handleDelete(p.id, p.title, e)}
                  title="删除作品"
                >
                  <IconX size={12} />
                </button>
              )}
            </div>
          ))}

          {/* 新建作品卡片（始终显示） */}
          <div
            className="flex min-h-[220px] cursor-pointer items-center justify-center rounded-xl border border-dashed border-surface-500 bg-surface-800/50 transition-colors hover:border-accent/40 hover:bg-surface-800"
            onClick={() => setShowCreateModal(true)}
          >
            <div className="text-center">
              <div className="flex justify-center text-gray-500 mb-1.5">
                <IconPlus size={24} />
              </div>
              <div className="text-[13px] text-gray-500">新建作品</div>
            </div>
          </div>
        </div>
      </div>

      <CreateProjectModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={(data) => void handleCreate(data)}
      />
    </div>
  )
}
