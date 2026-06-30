import { useEffect, useState } from 'react'
import type { Entity, EntityType } from '@magic-writer/shared'
import { useProjectStore } from '../stores/project'
import { IconWand, IconSparkles } from './Icons'

const GEN_TYPES: Array<{ type: EntityType; label: string; emoji: string }> = [
  { type: 'character', label: '角色', emoji: '🧑' },
  { type: 'prop', label: '道具', emoji: '⚔️' },
  { type: 'location', label: '地点', emoji: '🏔️' },
  { type: 'event', label: '事件', emoji: '⚡' },
  { type: 'foreshadowing', label: '伏笔', emoji: '🔮' }
]

const TYPE_LABEL: Record<string, string> = {
  character: '角色',
  prop: '道具',
  location: '地点',
  event: '事件',
  foreshadowing: '伏笔'
}

export function EntityForgePanel(): React.ReactElement {
  const currentProject = useProjectStore((s) => s.currentProject)
  const [entities, setEntities] = useState<Entity[]>([])
  const [hint, setHint] = useState('')
  const [generating, setGenerating] = useState<EntityType | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!currentProject) return
    void loadEntities()
  }, [currentProject?.id])

  async function loadEntities(): Promise<void> {
    if (!currentProject) return
    const list = await window.api.entity.list(currentProject.id)
    // 仅展示可由 AI 生成/管理的设定实体；排除章节与线索（线索属于「图谱」页的覆盖层）。
    setEntities(list.filter((e) => e.type !== 'chapter' && e.type !== 'storyline'))
  }

  async function handleGenerate(type: EntityType): Promise<void> {
    if (!currentProject || generating) return
    setGenerating(type)
    setError(null)
    try {
      const res = await window.api.entity.generate(currentProject.id, type, hint.trim() || undefined)
      if (!res.ok) {
        setError(res.error ?? '生成失败')
      } else {
        await loadEntities()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败')
    } finally {
      setGenerating(null)
    }
  }

  async function handleDelete(id: string): Promise<void> {
    await window.api.entity.delete(id)
    await loadEntities()
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-surface-600 px-3 py-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-300">
          <IconWand size={14} /> AI 百宝箱
        </h3>
      </div>

      <div className="border-b border-surface-600 p-2.5 space-y-2">
        <input
          className="input-field"
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          placeholder="可选：补充要求，如「一个亦正亦邪的老者」"
        />
        <div className="flex flex-wrap gap-1.5">
          {GEN_TYPES.map((g) => (
            <button
              key={g.type}
              className="flex items-center gap-1 rounded-lg border border-surface-600 bg-surface-700 px-2 py-1 text-xs text-gray-300 transition-colors hover:border-accent hover:text-accent-light disabled:opacity-50"
              onClick={() => void handleGenerate(g.type)}
              disabled={!!generating}
            >
              {generating === g.type ? (
                <IconSparkles size={12} className="animate-pulse" />
              ) : (
                <span>{g.emoji}</span>
              )}
              生成{g.label}
            </button>
          ))}
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        {generating && <p className="text-xs text-gray-500">AI 正在生成{TYPE_LABEL[generating]}…</p>}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {entities.length === 0 && (
          <p className="py-8 text-center text-xs text-gray-500">
            还没有实体，点击上方按钮让 AI 帮你生成
          </p>
        )}
        {entities.map((e) => (
          <div key={e.id} className="rounded-lg border border-surface-600 bg-surface-700 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="shrink-0 rounded bg-surface-500 px-1.5 py-0.5 text-[10px] text-gray-400">
                  {TYPE_LABEL[e.type] ?? e.type}
                </span>
                <span className="truncate text-sm font-medium text-gray-200">{e.name}</span>
              </div>
              <button
                className="shrink-0 rounded px-1.5 py-0.5 text-sm text-red-400 hover:bg-surface-500"
                onClick={() => void handleDelete(e.id)}
              >
                删除
              </button>
            </div>
            {e.summary && (
              <p className="mt-1 line-clamp-2 text-xs text-gray-400">{e.summary}</p>
            )}
            <EntityDataPreview entity={e} />
          </div>
        ))}
      </div>
    </div>
  )
}

function EntityDataPreview({ entity }: { entity: Entity }): React.ReactElement | null {
  const data = entity.data as Record<string, unknown>
  const chips: string[] = []
  const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : [])

  if (entity.type === 'character') {
    chips.push(...arr(data.abilities))
  } else if (entity.type === 'prop') {
    if (data.category) chips.push(String(data.category))
    chips.push(...arr(data.abilities))
  } else if (entity.type === 'location') {
    if (data.region) chips.push(String(data.region))
  } else if (entity.type === 'event') {
    if (data.time) chips.push(String(data.time))
    chips.push(...arr(data.participants))
  }

  if (chips.length === 0) return null
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {chips.map((c, i) => (
        <span key={i} className="rounded bg-surface-500 px-1.5 py-0.5 text-[11px] text-gray-400">
          {c}
        </span>
      ))}
    </div>
  )
}
