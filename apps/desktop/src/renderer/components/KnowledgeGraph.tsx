import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
  type NodeChange,
  type Connection
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  type Entity,
  type EntityRelation,
  type EntityType,
  STORYLINE_MEMBER_RELATION,
  STORYLINE_COLOR_POOL,
  GRAPH_ENTITY_TYPES
} from '@magic-writer/shared'
import { useProjectStore } from '../stores/project'
import {
  IconUser,
  IconZap,
  IconMapPin,
  IconBox,
  IconTarget,
  IconBook,
  IconRoute,
  IconNetwork,
  IconPlus,
  IconTrash,
  IconX,
  IconFilter
} from './Icons'

// ============================================================
// 类型元数据：颜色仅用于「类型区分」（取暖中性/低饱和度），
// 翡翠绿保留作为「选中/线索高亮」的信号色，符合设计规范。
// ============================================================

type GraphType = Exclude<EntityType, 'storyline'>

interface TypeMeta {
  label: string
  color: string
  Icon: (p: { size?: number; className?: string }) => React.ReactElement
}

const TYPE_META: Record<GraphType, TypeMeta> = {
  character: { label: '人物', color: '#5aa9c9', Icon: IconUser },
  event: { label: '事件', color: '#c98fb0', Icon: IconZap },
  location: { label: '地点', color: '#7fb37f', Icon: IconMapPin },
  prop: { label: '道具', color: '#b59b7a', Icon: IconBox },
  foreshadowing: { label: '伏笔', color: '#9d8ec9', Icon: IconTarget },
  chapter: { label: '章节', color: '#8b949e', Icon: IconBook }
}

interface EntityNodeData extends Record<string, unknown> {
  type: GraphType
  label: string
  summary: string
  dim?: boolean
  ringColor?: string
}

type EntityNode = Node<EntityNodeData>

// ============================================================
// 自定义节点：实体节点（图标 + 名称 + 类型徽标）
// ============================================================

function EntityNodeView({
  data,
  selected
}: {
  data: EntityNodeData
  selected?: boolean
}): React.ReactElement {
  const meta = TYPE_META[data.type]
  const Icon = meta.Icon
  const borderColor = data.ringColor ?? (selected ? '#00d992' : '#3d3a39')
  const borderWidth = data.ringColor || selected ? 2 : 1
  return (
    <div
      className="rounded-lg bg-surface-700 px-3 py-2 shadow-lg min-w-[112px] max-w-[160px] transition-opacity"
      style={{
        border: `${borderWidth}px solid ${borderColor}`,
        opacity: data.dim ? 0.22 : 1
      }}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !bg-surface-500" />
      <div className="flex items-center gap-1.5">
        <span style={{ color: meta.color }} className="shrink-0">
          <Icon size={14} />
        </span>
        <span className="truncate text-xs font-semibold text-gray-200">{data.label || '未命名'}</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !bg-surface-500" />
    </div>
  )
}

const nodeTypes: NodeTypes = { entity: EntityNodeView }

// ============================================================
// 布局：按类型聚类的放射状布局（确定性、稳定、可拖拽微调）
// ============================================================

function computeLayout(entities: Entity[]): Map<string, { x: number; y: number }> {
  const pos = new Map<string, { x: number; y: number }>()
  const byType = new Map<GraphType, Entity[]>()
  for (const e of entities) {
    const t = e.type as GraphType
    if (!byType.has(t)) byType.set(t, [])
    byType.get(t)!.push(e)
  }
  const present = GRAPH_ENTITY_TYPES.filter((t) => byType.get(t as GraphType)?.length)
  const CX = 600
  const CY = 420
  const clusterRadius = present.length > 1 ? 360 : 0

  present.forEach((type, ti) => {
    const items = byType.get(type as GraphType)!
    const ang = (2 * Math.PI * ti) / present.length - Math.PI / 2
    const ccx = CX + clusterRadius * Math.cos(ang)
    const ccy = CY + clusterRadius * Math.sin(ang)
    // 簇内栅格排布
    const cols = Math.max(1, Math.ceil(Math.sqrt(items.length)))
    const gapX = 150
    const gapY = 78
    items.forEach((e, i) => {
      const row = Math.floor(i / cols)
      const col = i % cols
      const rowCount = Math.ceil(items.length / cols)
      const x = ccx + (col - (cols - 1) / 2) * gapX
      const y = ccy + (row - (rowCount - 1) / 2) * gapY
      pos.set(e.id, { x, y })
    })
  })
  return pos
}

// ============================================================
// 主组件
// ============================================================

export function KnowledgeGraph(): React.ReactElement {
  const currentProject = useProjectStore((s) => s.currentProject)

  const [entities, setEntities] = useState<Entity[]>([])
  const [relations, setRelations] = useState<EntityRelation[]>([])

  // 过滤 / 高亮状态
  const [hiddenTypes, setHiddenTypes] = useState<Set<GraphType>>(new Set())
  const [activeStoryline, setActiveStoryline] = useState<string | 'all' | null>(null)
  const [storylineMode, setStorylineMode] = useState<'highlight' | 'subgraph'>('highlight')

  // 选中详情
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)

  // 新建节点 / 新建线索 的临时表单
  const [newNodeType, setNewNodeType] = useState<GraphType | null>(null)
  const [newNodeName, setNewNodeName] = useState('')
  const [newStorylineName, setNewStorylineName] = useState('')
  const [creatingStoryline, setCreatingStoryline] = useState(false)

  // 拖拽位置缓存：过滤/高亮重建节点时保留用户手动调整的位置
  const posRef = useRef<Map<string, { x: number; y: number }>>(new Map())

  useEffect(() => {
    if (!currentProject) return
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject?.id])

  async function reload(): Promise<void> {
    if (!currentProject) return
    const [allEntities, allRelations] = await Promise.all([
      window.api.entity.list(currentProject.id),
      window.api.relation.list(currentProject.id)
    ])
    setEntities(allEntities)
    setRelations(allRelations)
  }

  // ---------- 数据拆分：图谱节点 / 普通关系 / 线索 / 线索成员 ----------
  const {
    graphEntities,
    graphRelations,
    storylines,
    membersByStoryline,
    storylinesByEntity,
    storylineColor
  } = useMemo(() => {
    const graphEntities = entities.filter((e) => e.type !== 'storyline')
    const graphIds = new Set(graphEntities.map((e) => e.id))
    const storylines = entities
      .filter((e) => e.type === 'storyline')
      .sort((a, b) => a.order - b.order)

    const memberRels = relations.filter(
      (r) => r.fromType === 'storyline' && r.type === STORYLINE_MEMBER_RELATION
    )
    const graphRelations = relations.filter(
      (r) =>
        r.fromType !== 'storyline' &&
        r.type !== STORYLINE_MEMBER_RELATION &&
        graphIds.has(r.fromId) &&
        graphIds.has(r.toId)
    )

    const membersByStoryline = new Map<string, Set<string>>()
    const storylinesByEntity = new Map<string, string[]>()
    for (const r of memberRels) {
      if (!graphIds.has(r.toId)) continue
      if (!membersByStoryline.has(r.fromId)) membersByStoryline.set(r.fromId, new Set())
      membersByStoryline.get(r.fromId)!.add(r.toId)
      const arr = storylinesByEntity.get(r.toId) ?? []
      arr.push(r.fromId)
      storylinesByEntity.set(r.toId, arr)
    }

    const storylineColor = new Map<string, string>()
    storylines.forEach((s, i) => {
      const data = s.data as { color?: string }
      storylineColor.set(s.id, data.color || STORYLINE_COLOR_POOL[i % STORYLINE_COLOR_POOL.length])
    })

    return {
      graphEntities,
      graphRelations,
      storylines,
      membersByStoryline,
      storylinesByEntity,
      storylineColor
    }
  }, [entities, relations])

  const entityMap = useMemo(() => new Map(graphEntities.map((e) => [e.id, e])), [graphEntities])

  // ---------- 基础节点/边（位置确定性，叠加拖拽缓存） ----------
  const baseNodes = useMemo<EntityNode[]>(() => {
    const layout = computeLayout(graphEntities)
    return graphEntities.map((e) => ({
      id: e.id,
      type: 'entity',
      position: posRef.current.get(e.id) ?? layout.get(e.id) ?? { x: 0, y: 0 },
      data: {
        type: e.type as GraphType,
        label: e.name,
        summary: e.summary
      }
    }))
  }, [graphEntities])

  const baseEdges = useMemo<Edge[]>(
    () =>
      graphRelations.map((r) => ({
        id: r.id,
        source: r.fromId,
        target: r.toId,
        label: r.type || r.note || undefined
      })),
    [graphRelations]
  )

  const [nodes, setNodes, rfOnNodesChange] = useNodesState<EntityNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  const onNodesChange = useCallback(
    (changes: NodeChange<EntityNode>[]) => {
      for (const c of changes) {
        if (c.type === 'position' && c.position) posRef.current.set(c.id, c.position)
      }
      rfOnNodesChange(changes)
    },
    [rfOnNodesChange]
  )

  // ---------- 应用过滤/高亮，重建可视节点与边 ----------
  useEffect(() => {
    const memberSet =
      activeStoryline && activeStoryline !== 'all'
        ? (membersByStoryline.get(activeStoryline) ?? new Set<string>())
        : null

    const displayNodes: EntityNode[] = baseNodes.map((n) => {
      const typeHidden = hiddenTypes.has(n.data.type)
      let dim = false
      let ringColor: string | undefined

      if (activeStoryline === 'all') {
        const sids = storylinesByEntity.get(n.id)
        if (sids && sids.length > 0) ringColor = storylineColor.get(sids[0])
      } else if (memberSet) {
        const isMember = memberSet.has(n.id)
        if (storylineMode === 'highlight') {
          dim = !isMember
          if (isMember) ringColor = storylineColor.get(activeStoryline as string)
        }
      }

      const hidden =
        typeHidden || (memberSet !== null && storylineMode === 'subgraph' && !memberSet.has(n.id))

      return {
        ...n,
        hidden,
        data: { ...n.data, dim, ringColor }
      }
    })

    const visibleIds = new Set(displayNodes.filter((n) => !n.hidden).map((n) => n.id))

    const displayEdges: Edge[] = baseEdges.map((e) => {
      const endpointsVisible = visibleIds.has(e.source) && visibleIds.has(e.target)
      let stroke = '#3d3a39'
      let dim = false

      if (activeStoryline === 'all') {
        const shared = sharedStoryline(e.source, e.target, storylinesByEntity)
        if (shared) stroke = storylineColor.get(shared) ?? stroke
      } else if (memberSet && storylineMode === 'highlight') {
        const inLine = memberSet.has(e.source) && memberSet.has(e.target)
        dim = !inLine
        if (inLine) stroke = storylineColor.get(activeStoryline as string) ?? stroke
      }

      return {
        ...e,
        hidden: !endpointsVisible,
        animated: !dim && !!memberSet && memberSet.has(e.source) && memberSet.has(e.target),
        style: { stroke, strokeWidth: dim ? 1 : 1.5, opacity: dim ? 0.18 : 1 },
        labelStyle: { fill: '#8b949e', fontSize: 10 },
        labelBgStyle: { fill: '#101010' }
      }
    })

    setNodes(displayNodes)
    setEdges(displayEdges)
  }, [
    baseNodes,
    baseEdges,
    hiddenTypes,
    activeStoryline,
    storylineMode,
    membersByStoryline,
    storylinesByEntity,
    storylineColor,
    setNodes,
    setEdges
  ])

  // ---------- 交互：连线建关系 / 选中 / 删除 ----------
  const onConnect = useCallback(
    async (conn: Connection) => {
      if (!currentProject || !conn.source || !conn.target || conn.source === conn.target) return
      const from = entityMap.get(conn.source)
      const to = entityMap.get(conn.target)
      if (!from || !to) return
      const rel = await window.api.relation.upsert({
        projectId: currentProject.id,
        fromId: from.id,
        fromType: from.type,
        toId: to.id,
        toType: to.type,
        type: '',
        note: ''
      })
      await reload()
      setSelectedNodeId(null)
      setSelectedEdgeId(rel.id)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentProject?.id, entityMap]
  )

  function toggleType(t: GraphType): void {
    setHiddenTypes((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }

  async function handleCreateNode(): Promise<void> {
    if (!currentProject || !newNodeType || !newNodeName.trim()) return
    await window.api.entity.upsert({
      projectId: currentProject.id,
      type: newNodeType,
      name: newNodeName.trim()
    })
    setNewNodeType(null)
    setNewNodeName('')
    await reload()
  }

  async function handleCreateStoryline(): Promise<void> {
    if (!currentProject || !newStorylineName.trim()) return
    const color = STORYLINE_COLOR_POOL[storylines.length % STORYLINE_COLOR_POOL.length]
    await window.api.entity.upsert({
      projectId: currentProject.id,
      type: 'storyline',
      name: newStorylineName.trim(),
      data: { color }
    })
    setNewStorylineName('')
    setCreatingStoryline(false)
    await reload()
  }

  async function handleDeleteStoryline(id: string): Promise<void> {
    await window.api.entity.delete(id)
    if (activeStoryline === id) setActiveStoryline(null)
    await reload()
  }

  const selectedEntity = selectedNodeId ? entityMap.get(selectedNodeId) ?? null : null
  const selectedRelation = selectedEdgeId
    ? graphRelations.find((r) => r.id === selectedEdgeId) ?? null
    : null

  if (!currentProject) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500">
        请先打开一个作品
      </div>
    )
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-surface-900">
      {/* ===== 左侧控制栏：类型过滤 + 线索 ===== */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-surface-600 bg-surface-800">
        <div className="flex items-center gap-1.5 border-b border-surface-600 px-3 py-2.5 text-sm font-semibold text-gray-300">
          <IconNetwork size={15} /> 知识图谱
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* 类型过滤 */}
          <section className="border-b border-surface-600 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">
              <IconFilter size={12} /> 实体类型
            </div>
            <div className="space-y-1">
              {GRAPH_ENTITY_TYPES.map((t) => {
                const type = t as GraphType
                const meta = TYPE_META[type]
                const Icon = meta.Icon
                const visible = !hiddenTypes.has(type)
                const count = graphEntities.filter((e) => e.type === type).length
                return (
                  <button
                    key={type}
                    onClick={() => toggleType(type)}
                    className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-xs transition-colors ${
                      visible
                        ? 'border-surface-600 bg-surface-700 text-gray-200'
                        : 'border-transparent text-gray-600'
                    }`}
                  >
                    <span style={{ color: visible ? meta.color : '#52525b' }}>
                      <Icon size={13} />
                    </span>
                    <span className="flex-1 text-left">{meta.label}</span>
                    <span className="text-[10px] text-gray-500">{count}</span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* 线索 / 故事线 */}
          <section className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">
                <IconRoute size={12} /> 线索
              </span>
              <button
                className="rounded p-0.5 text-accent-light hover:bg-surface-700"
                title="新建线索"
                onClick={() => setCreatingStoryline((v) => !v)}
              >
                <IconPlus size={13} />
              </button>
            </div>

            {creatingStoryline && (
              <div className="mb-2 flex gap-1">
                <input
                  autoFocus
                  className="input-field !py-1 !text-xs"
                  placeholder="线索名，如主线/感情线"
                  value={newStorylineName}
                  onChange={(e) => setNewStorylineName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleCreateStoryline()
                    if (e.key === 'Escape') setCreatingStoryline(false)
                  }}
                />
                <button
                  className="shrink-0 rounded bg-accent px-2 text-xs text-on-accent hover:bg-accent-80"
                  onClick={() => void handleCreateStoryline()}
                >
                  建
                </button>
              </div>
            )}

            <div className="space-y-1">
              <StorylineRow
                label="无高亮"
                active={activeStoryline === null}
                onClick={() => setActiveStoryline(null)}
              />
              {storylines.length > 0 && (
                <StorylineRow
                  label="全部线索（总览）"
                  active={activeStoryline === 'all'}
                  onClick={() => setActiveStoryline('all')}
                  rainbow
                />
              )}
              {storylines.map((s) => {
                const count = membersByStoryline.get(s.id)?.size ?? 0
                return (
                  <div key={s.id} className="group flex items-center gap-1">
                    <button
                      onClick={() => setActiveStoryline(s.id)}
                      className={`flex flex-1 items-center gap-2 rounded-lg border px-2 py-1.5 text-xs transition-colors ${
                        activeStoryline === s.id
                          ? 'border-accent bg-accent-15 text-gray-100'
                          : 'border-surface-600 bg-surface-700 text-gray-300'
                      }`}
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: storylineColor.get(s.id) }}
                      />
                      <span className="flex-1 truncate text-left">{s.name}</span>
                      <span className="text-[10px] text-gray-500">{count}</span>
                    </button>
                    <button
                      className="rounded p-1 text-gray-600 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                      title="删除线索"
                      onClick={() => void handleDeleteStoryline(s.id)}
                    >
                      <IconTrash size={12} />
                    </button>
                  </div>
                )
              })}
            </div>

            {/* 子图/高亮模式切换（仅在选中具体线索时有意义） */}
            {activeStoryline && activeStoryline !== 'all' && (
              <div className="mt-2 flex rounded-lg border border-surface-600 p-0.5 text-[11px]">
                <button
                  className={`flex-1 rounded px-2 py-1 ${
                    storylineMode === 'highlight' ? 'bg-surface-600 text-gray-100' : 'text-gray-500'
                  }`}
                  onClick={() => setStorylineMode('highlight')}
                >
                  高亮
                </button>
                <button
                  className={`flex-1 rounded px-2 py-1 ${
                    storylineMode === 'subgraph' ? 'bg-surface-600 text-gray-100' : 'text-gray-500'
                  }`}
                  onClick={() => setStorylineMode('subgraph')}
                >
                  仅子图
                </button>
              </div>
            )}
          </section>
        </div>

        {/* 新建节点 */}
        <div className="border-t border-surface-600 p-3">
          {newNodeType ? (
            <div className="space-y-1.5">
              <div className="flex flex-wrap gap-1">
                {GRAPH_ENTITY_TYPES.filter((t) => t !== 'chapter').map((t) => {
                  const type = t as GraphType
                  return (
                    <button
                      key={type}
                      onClick={() => setNewNodeType(type)}
                      className={`rounded border px-1.5 py-0.5 text-[11px] ${
                        newNodeType === type
                          ? 'border-accent text-accent-light'
                          : 'border-surface-600 text-gray-400'
                      }`}
                    >
                      {TYPE_META[type].label}
                    </button>
                  )
                })}
              </div>
              <div className="flex gap-1">
                <input
                  autoFocus
                  className="input-field !py-1 !text-xs"
                  placeholder={`新${TYPE_META[newNodeType].label}名称`}
                  value={newNodeName}
                  onChange={(e) => setNewNodeName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleCreateNode()
                    if (e.key === 'Escape') setNewNodeType(null)
                  }}
                />
                <button
                  className="shrink-0 rounded bg-accent px-2 text-xs text-on-accent hover:bg-accent-80"
                  onClick={() => void handleCreateNode()}
                >
                  建
                </button>
              </div>
            </div>
          ) : (
            <button
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-surface-600 bg-surface-700 py-1.5 text-xs text-gray-300 hover:border-accent hover:text-accent-light"
              onClick={() => setNewNodeType('character')}
            >
              <IconPlus size={13} /> 新建节点
            </button>
          )}
        </div>
      </aside>

      {/* ===== 画布 ===== */}
      <div className="relative flex-1">
        {graphEntities.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mb-2 flex justify-center text-gray-500">
                <IconNetwork size={32} />
              </div>
              <p className="text-xs text-gray-500">暂无实体</p>
              <p className="mt-1 text-sm text-gray-600">
                在 AI 百宝箱/人物面板创建实体，或用左下「新建节点」开始
              </p>
            </div>
          </div>
        ) : (
          <ReactFlow<EntityNode>
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={(c) => void onConnect(c)}
            nodeTypes={nodeTypes}
            onNodeClick={(_e, n) => {
              setSelectedNodeId(n.id)
              setSelectedEdgeId(null)
            }}
            onEdgeClick={(_e, ed) => {
              setSelectedEdgeId(ed.id)
              setSelectedNodeId(null)
            }}
            onPaneClick={() => {
              setSelectedNodeId(null)
              setSelectedEdgeId(null)
            }}
            fitView
            minZoom={0.2}
            proOptions={{ hideAttribution: true }}
            style={{ background: '#050507' }}
          >
            <Background color="#3d3a39" gap={22} />
            <Controls
              showInteractive={false}
              style={{ background: '#101010', borderColor: '#3d3a39' }}
            />
          </ReactFlow>
        )}
      </div>

      {/* ===== 右侧详情抽屉 ===== */}
      {selectedEntity && (
        <NodeDetail
          key={selectedEntity.id}
          entity={selectedEntity}
          relations={graphRelations.filter(
            (r) => r.fromId === selectedEntity.id || r.toId === selectedEntity.id
          )}
          entityMap={entityMap}
          storylines={storylines}
          storylinesByEntity={storylinesByEntity}
          storylineColor={storylineColor}
          relationsRaw={relations}
          projectId={currentProject.id}
          onClose={() => setSelectedNodeId(null)}
          onChanged={reload}
        />
      )}
      {selectedRelation && (
        <EdgeDetail
          key={selectedRelation.id}
          relation={selectedRelation}
          entityMap={entityMap}
          onClose={() => setSelectedEdgeId(null)}
          onChanged={reload}
        />
      )}
    </div>
  )
}

// ============================================================
// 子组件：线索行（无高亮 / 全部线索）
// ============================================================

function StorylineRow({
  label,
  active,
  onClick,
  rainbow
}: {
  label: string
  active: boolean
  onClick: () => void
  rainbow?: boolean
}): React.ReactElement {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-xs transition-colors ${
        active
          ? 'border-accent bg-accent-15 text-gray-100'
          : 'border-surface-600 bg-surface-700 text-gray-300'
      }`}
    >
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={
          rainbow
            ? { background: 'conic-gradient(#5aa9c9,#c98fb0,#9d8ec9,#7fb37f,#5aa9c9)' }
            : { border: '1px solid #4f4b49' }
        }
      />
      <span className="flex-1 truncate text-left">{label}</span>
    </button>
  )
}

// ============================================================
// 子组件：节点详情（编辑名称/摘要、关系列表、线索归属、删除）
// ============================================================

function NodeDetail({
  entity,
  relations,
  entityMap,
  storylines,
  storylinesByEntity,
  storylineColor,
  relationsRaw,
  projectId,
  onClose,
  onChanged
}: {
  entity: Entity
  relations: EntityRelation[]
  entityMap: Map<string, Entity>
  storylines: Entity[]
  storylinesByEntity: Map<string, string[]>
  storylineColor: Map<string, string>
  relationsRaw: EntityRelation[]
  projectId: string
  onClose: () => void
  onChanged: () => Promise<void>
}): React.ReactElement {
  const meta = TYPE_META[entity.type as GraphType]
  const [name, setName] = useState(entity.name)
  const [summary, setSummary] = useState(entity.summary)
  const memberOf = new Set(storylinesByEntity.get(entity.id) ?? [])

  async function save(): Promise<void> {
    await window.api.entity.upsert({
      id: entity.id,
      projectId,
      type: entity.type,
      name: name.trim(),
      summary
    })
    await onChanged()
  }

  async function remove(): Promise<void> {
    await window.api.entity.delete(entity.id)
    onClose()
    await onChanged()
  }

  async function toggleStoryline(storylineId: string): Promise<void> {
    if (memberOf.has(storylineId)) {
      const rel = relationsRaw.find(
        (r) =>
          r.fromId === storylineId &&
          r.toId === entity.id &&
          r.type === STORYLINE_MEMBER_RELATION
      )
      if (rel) await window.api.relation.delete(rel.id)
    } else {
      await window.api.relation.upsert({
        projectId,
        fromId: storylineId,
        fromType: 'storyline',
        toId: entity.id,
        toType: entity.type,
        type: STORYLINE_MEMBER_RELATION,
        note: ''
      })
    }
    await onChanged()
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-surface-600 bg-surface-800">
      <div className="flex items-center justify-between border-b border-surface-600 px-3 py-2.5">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-200">
          <span style={{ color: meta.color }}>
            <meta.Icon size={14} />
          </span>
          {meta.label}详情
        </span>
        <button className="rounded p-1 text-gray-500 hover:text-gray-300" onClick={onClose}>
          <IconX size={14} />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        <div>
          <label className="mb-1 block text-xs text-gray-500">名称</label>
          <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">摘要</label>
          <textarea
            className="input-field resize-none"
            rows={3}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        </div>
        <button
          className="w-full rounded-lg bg-accent py-1.5 text-xs text-on-accent hover:bg-accent-80"
          onClick={() => void save()}
        >
          保存
        </button>

        {/* 线索归属 */}
        <div>
          <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">
            所属线索
          </div>
          {storylines.length === 0 ? (
            <p className="text-[11px] text-gray-600">还没有线索，先在左侧新建</p>
          ) : (
            <div className="space-y-1">
              {storylines.map((s) => {
                const checked = memberOf.has(s.id)
                return (
                  <button
                    key={s.id}
                    onClick={() => void toggleStoryline(s.id)}
                    className={`flex w-full items-center gap-2 rounded border px-2 py-1 text-xs ${
                      checked
                        ? 'border-accent bg-accent-15 text-gray-100'
                        : 'border-surface-600 text-gray-400'
                    }`}
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: storylineColor.get(s.id) }}
                    />
                    <span className="flex-1 truncate text-left">{s.name}</span>
                    {checked && <span className="text-accent-light">✓</span>}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* 关联关系 */}
        <div>
          <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">
            关联（{relations.length}）
          </div>
          {relations.length === 0 ? (
            <p className="text-[11px] text-gray-600">从此节点拖拽连线可创建关系</p>
          ) : (
            <div className="space-y-1">
              {relations.map((r) => {
                const otherId = r.fromId === entity.id ? r.toId : r.fromId
                const other = entityMap.get(otherId)
                const dir = r.fromId === entity.id ? '→' : '←'
                return (
                  <div
                    key={r.id}
                    className="rounded border border-surface-600 bg-surface-700 px-2 py-1 text-[11px] text-gray-300"
                  >
                    <span className="text-gray-500">{dir} </span>
                    {other?.name ?? '未知'}
                    {r.type && <span className="ml-1 text-accent-light">[{r.type}]</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-surface-600 p-3">
        <button
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-surface-600 py-1.5 text-xs text-red-400 hover:bg-surface-700"
          onClick={() => void remove()}
        >
          <IconTrash size={13} /> 删除此节点
        </button>
      </div>
    </aside>
  )
}

// ============================================================
// 子组件：关系详情（编辑类型/备注、删除）
// ============================================================

function EdgeDetail({
  relation,
  entityMap,
  onClose,
  onChanged
}: {
  relation: EntityRelation
  entityMap: Map<string, Entity>
  onClose: () => void
  onChanged: () => Promise<void>
}): React.ReactElement {
  const [type, setType] = useState(relation.type)
  const [note, setNote] = useState(relation.note)
  const from = entityMap.get(relation.fromId)
  const to = entityMap.get(relation.toId)

  async function save(): Promise<void> {
    await window.api.relation.upsert({
      id: relation.id,
      projectId: relation.projectId,
      fromId: relation.fromId,
      fromType: relation.fromType,
      toId: relation.toId,
      toType: relation.toType,
      type: type.trim(),
      note
    })
    await onChanged()
  }

  async function remove(): Promise<void> {
    await window.api.relation.delete(relation.id)
    onClose()
    await onChanged()
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-surface-600 bg-surface-800">
      <div className="flex items-center justify-between border-b border-surface-600 px-3 py-2.5">
        <span className="text-sm font-semibold text-gray-200">关系详情</span>
        <button className="rounded p-1 text-gray-500 hover:text-gray-300" onClick={onClose}>
          <IconX size={14} />
        </button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        <div className="rounded border border-surface-600 bg-surface-700 px-2 py-1.5 text-xs text-gray-300">
          <span className="font-medium text-gray-100">{from?.name ?? '未知'}</span>
          <span className="mx-1 text-gray-500">→</span>
          <span className="font-medium text-gray-100">{to?.name ?? '未知'}</span>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">关系类型</label>
          <input
            className="input-field"
            value={type}
            placeholder="如：师徒/敌对/同盟/起因"
            onChange={(e) => setType(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">备注</label>
          <textarea
            className="input-field resize-none"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <button
          className="w-full rounded-lg bg-accent py-1.5 text-xs text-on-accent hover:bg-accent-80"
          onClick={() => void save()}
        >
          保存
        </button>
      </div>
      <div className="border-t border-surface-600 p-3">
        <button
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-surface-600 py-1.5 text-xs text-red-400 hover:bg-surface-700"
          onClick={() => void remove()}
        >
          <IconTrash size={13} /> 删除此关系
        </button>
      </div>
    </aside>
  )
}

// ============================================================
// 工具
// ============================================================

function sharedStoryline(
  a: string,
  b: string,
  storylinesByEntity: Map<string, string[]>
): string | null {
  const sa = storylinesByEntity.get(a)
  const sb = storylinesByEntity.get(b)
  if (!sa || !sb) return null
  for (const id of sa) if (sb.includes(id)) return id
  return null
}
