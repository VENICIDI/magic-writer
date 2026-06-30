import { useEffect, useState } from 'react'
import type { Foreshadowing } from '@magic-writer/shared'
import { useProjectStore } from '../stores/project'
import { IconTarget, IconPlus, IconCheck, IconX } from './Icons'

export function ForeshadowingPanel(): React.ReactElement {
  const currentProject = useProjectStore((s) => s.currentProject)
  const currentChapter = useProjectStore((s) => s.currentChapter)
  const [items, setItems] = useState<Foreshadowing[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [newDesc, setNewDesc] = useState('')

  useEffect(() => {
    if (!currentProject) return
    void loadItems()
  }, [currentProject?.id])

  async function loadItems(): Promise<void> {
    if (!currentProject) return
    const list = await (window as any).api.world?.listForeshadowing?.(currentProject.id) as Foreshadowing[] | undefined
    // 如果 API 尚不存在（preload 未暴露），使用空数组
    setItems(list ?? [])
  }

  async function handleAdd(): Promise<void> {
    if (!currentProject || !newDesc.trim()) return
    const item: Foreshadowing = {
      id: `fs-${Date.now()}`,
      projectId: currentProject.id,
      description: newDesc.trim(),
      plantedAt: {
        chapterId: currentChapter?.id ?? '',
        offset: 0
      },
      status: 'pending'
    }
    // 调用 upsert（如果 preload 暴露了的话）
    try {
      await (window as any).api?.world?.upsertForeshadowing?.(item)
    } catch { /* */ }
    setItems((prev) => [...prev, item])
    setNewDesc('')
    setShowAdd(false)
  }

  function updateStatus(id: string, status: 'resolved' | 'abandoned'): void {
    setItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? {
              ...it,
              status,
              resolvedAt: status === 'resolved'
                ? { chapterId: currentChapter?.id ?? '', offset: 0 }
                : it.resolvedAt
            }
          : it
      )
    )
  }

  const pending = items.filter((i) => i.status === 'pending')
  const resolved = items.filter((i) => i.status === 'resolved')
  const abandoned = items.filter((i) => i.status === 'abandoned')

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-surface-600 px-3 py-2">
        <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-1.5"><IconTarget size={14} /> 伏笔追踪</h3>
        <button
          className="rounded px-2 py-1 text-xs text-accent-light hover:bg-surface-600 flex items-center gap-1"
          onClick={() => setShowAdd(true)}
        >
          <IconPlus size={10} /> 埋伏笔
        </button>
      </div>

      {showAdd && (
        <div className="border-b border-surface-600 p-3 space-y-2">
          <textarea
            className="input-field resize-none"
            rows={2}
            placeholder="描述这个伏笔…"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              className="rounded bg-accent px-2 py-1 text-xs text-on-accent hover:bg-accent-80"
              onClick={handleAdd}
            >
              添加
            </button>
            <button
              className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-surface-600"
              onClick={() => setShowAdd(false)}
            >
              取消
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {pending.length > 0 && (
          <Group title={`待回收 (${pending.length})`} color="text-amber-400">
            {pending.map((item) => (
              <ForeshadowingItem
                key={item.id}
                item={item}
                onResolve={() => updateStatus(item.id, 'resolved')}
                onAbandon={() => updateStatus(item.id, 'abandoned')}
              />
            ))}
          </Group>
        )}
        {resolved.length > 0 && (
          <Group title={`已回收 (${resolved.length})`} color="text-green-400">
            {resolved.map((item) => (
              <ForeshadowingItem key={item.id} item={item} />
            ))}
          </Group>
        )}
        {abandoned.length > 0 && (
          <Group title={`已废弃 (${abandoned.length})`} color="text-gray-500">
            {abandoned.map((item) => (
              <ForeshadowingItem key={item.id} item={item} />
            ))}
          </Group>
        )}
        {items.length === 0 && (
          <p className="text-center text-xs text-gray-500 py-8">暂无伏笔</p>
        )}
      </div>
    </div>
  )
}

function Group({ title, color, children }: { title: string; color?: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div>
      <div className={`text-sm font-medium mb-1 ${color ?? 'text-gray-400'}`}>{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function ForeshadowingItem({
  item,
  onResolve,
  onAbandon
}: {
  item: Foreshadowing
  onResolve?: () => void
  onAbandon?: () => void
}): React.ReactElement {
  return (
    <div className="rounded border border-surface-600 bg-surface-700 px-2.5 py-2">
      <div className="text-sm text-gray-300 leading-4">{item.description}</div>
      {item.status === 'pending' && (
        <div className="flex gap-2 mt-1.5">
          <button
            className="text-sm text-green-400 hover:underline"
            onClick={onResolve}
          >
            ✓ 标记回收
          </button>
          <button
            className="text-sm text-gray-500 hover:underline"
            onClick={onAbandon}
          >
            ✗ 废弃
          </button>
        </div>
      )}
    </div>
  )
}
