import { useEffect, useState } from 'react'
import type { Character } from '@magic-writer/shared'
import { useProjectStore } from '../stores/project'
import { RelationGraph } from './RelationGraph'
import { IconGlobe, IconNetwork, IconLock, IconUnlock, IconPlus, IconArrowLeft, IconWand } from './Icons'

export function WorldPanel(): React.ReactElement {
  const currentProject = useProjectStore((s) => s.currentProject)
  const [characters, setCharacters] = useState<Character[]>([])
  const [editing, setEditing] = useState<Character | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [view, setView] = useState<'list' | 'graph'>('list')
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (!currentProject) return
    void loadCharacters()
  }, [currentProject?.id])

  async function loadCharacters(): Promise<void> {
    if (!currentProject) return
    const list = await window.api.world.listCharacters(currentProject.id)
    setCharacters(list)
  }

  async function handleSave(character: Character): Promise<void> {
    await window.api.world.upsertCharacter(character)
    await loadCharacters()
    setShowForm(false)
    setEditing(null)
  }

  async function handleDelete(id: string): Promise<void> {
    await window.api.world.deleteCharacter(id)
    await loadCharacters()
  }

  function handleNew(): void {
    if (!currentProject) return
    setEditing({
      id: `char-${Date.now()}`,
      projectId: currentProject.id,
      name: '',
      aliases: [],
      appearance: '',
      personality: '',
      abilities: [],
      relations: [],
      lockedFields: []
    })
    setShowForm(true)
  }

  function handleEdit(char: Character): void {
    setEditing({ ...char })
    setShowForm(true)
  }

  async function handleAIGenerate(): Promise<void> {
    if (!currentProject || generating) return
    setGenerating(true)
    try {
      await window.api.entity.generate(currentProject.id, 'character')
      await loadCharacters()
    } finally {
      setGenerating(false)
    }
  }

  if (showForm && editing) {
    return (
      <CharacterForm
        character={editing}
        onSave={handleSave}
        onCancel={() => { setShowForm(false); setEditing(null) }}
      />
    )
  }

  if (view === 'graph') {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between border-b border-surface-600 px-3 py-2">
          <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-1.5"><IconNetwork size={14} /> 关系图</h3>
          <button
            className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-surface-600 flex items-center gap-1"
            onClick={() => setView('list')}
          >
            <IconArrowLeft size={12} /> 返回
          </button>
        </div>
        <div className="flex-1">
          <RelationGraph />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-surface-600 px-3 py-2">
        <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-1.5"><IconGlobe size={14} /> 人物</h3>
        <div className="flex gap-1">
          <button
            className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-surface-600"
            onClick={() => setView('graph')}
            title="查看关系图"
          >
            <IconNetwork size={12} />
          </button>
          <button
            className="rounded px-2 py-1 text-xs text-accent-light hover:bg-surface-600 disabled:opacity-50"
            onClick={() => void handleAIGenerate()}
            disabled={generating}
            title="AI 随机生成角色"
          >
            <IconWand size={12} className={generating ? 'animate-pulse' : ''} />
          </button>
          <button
            className="rounded px-2 py-1 text-xs text-accent-light hover:bg-surface-600"
            onClick={handleNew}
            title="新建人物"
          >
            <IconPlus size={12} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {characters.length === 0 && (
          <p className="text-center text-xs text-gray-500 py-8">暂无人物卡</p>
        )}
        {characters.map((char) => (
          <div
            key={char.id}
            className="rounded-lg border border-surface-600 bg-surface-700 p-3"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-200">{char.name}</span>
                {char.aliases.length > 0 && (
                  <span className="ml-2 text-xs text-gray-500">
                    ({char.aliases.join('、')})
                  </span>
                )}
              </div>
              <div className="flex gap-1">
                <button
                  className="rounded px-1.5 py-0.5 text-sm text-gray-400 hover:bg-surface-500"
                  onClick={() => handleEdit(char)}
                >
                  编辑
                </button>
                <button
                  className="rounded px-1.5 py-0.5 text-sm text-red-400 hover:bg-surface-500"
                  onClick={() => handleDelete(char.id)}
                >
                  删除
                </button>
              </div>
            </div>
            {char.personality && (
              <p className="mt-1 text-xs text-gray-400 line-clamp-2">
                {char.lockedFields.includes('personality') && <IconLock size={10} className="inline mr-0.5" />}
                {char.personality}
              </p>
            )}
            {char.abilities.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {char.abilities.map((a, i) => (
                  <span key={i} className="rounded bg-surface-500 px-1.5 py-0.5 text-sm text-gray-400">
                    {a}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// 人物卡编辑表单
// ============================================================

function CharacterForm({
  character,
  onSave,
  onCancel
}: {
  character: Character
  onSave: (c: Character) => void
  onCancel: () => void
}): React.ReactElement {
  const [form, setForm] = useState<Character>(character)

  function update<K extends keyof Character>(key: K, value: Character[K]): void {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function toggleLock(field: string): void {
    setForm((f) => ({
      ...f,
      lockedFields: f.lockedFields.includes(field)
        ? f.lockedFields.filter((x) => x !== field)
        : [...f.lockedFields, field]
    }))
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-surface-600 px-3 py-2">
        <h3 className="text-sm font-semibold text-gray-300">
          {character.name ? `编辑: ${character.name}` : '新建人物'}
        </h3>
        <div className="flex gap-2">
          <button
            className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-surface-600"
            onClick={onCancel}
          >
            取消
          </button>
          <button
            className="rounded bg-accent px-2 py-1 text-xs text-on-accent hover:bg-accent-80"
            onClick={() => onSave(form)}
          >
            保存
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <Field label="姓名" required>
          <input
            className="input-field"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="角色姓名"
          />
        </Field>
        <Field label="别名">
          <input
            className="input-field"
            value={form.aliases.join('、')}
            onChange={(e) => update('aliases', e.target.value.split('、').filter(Boolean))}
            placeholder="用顿号分隔"
          />
        </Field>
        <Field label="年龄">
          <input
            className="input-field"
            type="number"
            value={form.age ?? ''}
            onChange={(e) => update('age', e.target.value ? parseInt(e.target.value) : undefined)}
          />
        </Field>
        <Field label="外貌" lockable locked={form.lockedFields.includes('appearance')} onToggleLock={() => toggleLock('appearance')}>
          <textarea
            className="input-field resize-none"
            rows={2}
            value={form.appearance}
            onChange={(e) => update('appearance', e.target.value)}
          />
        </Field>
        <Field label="性格" lockable locked={form.lockedFields.includes('personality')} onToggleLock={() => toggleLock('personality')}>
          <textarea
            className="input-field resize-none"
            rows={2}
            value={form.personality}
            onChange={(e) => update('personality', e.target.value)}
          />
        </Field>
        <Field label="能力">
          <input
            className="input-field"
            value={form.abilities.join('、')}
            onChange={(e) => update('abilities', e.target.value.split('、').filter(Boolean))}
            placeholder="用顿号分隔"
          />
        </Field>
      </div>
    </div>
  )
}

function Field({
  label,
  required,
  lockable,
  locked,
  onToggleLock,
  children
}: {
  label: string
  required?: boolean
  lockable?: boolean
  locked?: boolean
  onToggleLock?: () => void
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div>
      <div className="flex items-center gap-1 mb-1">
        <label className="text-xs text-gray-400">
          {label}
          {required && <span className="text-red-400">*</span>}
        </label>
        {lockable && (
          <button
            className={`${locked ? 'text-amber-400' : 'text-gray-600'}`}
            onClick={onToggleLock}
            title={locked ? '已锁定（AI 不可修改）' : '点击锁定'}
          >
            {locked ? <IconLock size={10} /> : <IconUnlock size={10} />}
          </button>
        )}
      </div>
      {children}
    </div>
  )
}
