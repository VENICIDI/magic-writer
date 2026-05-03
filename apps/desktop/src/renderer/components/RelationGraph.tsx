import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeTypes,
  Handle,
  Position,
  useNodesState,
  useEdgesState
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { Character } from '@magic-writer/shared'
import { useProjectStore } from '../stores/project'
import { IconNetwork } from './Icons'

// ============================================================
// 自定义节点：人物卡节点
// ============================================================

function CharacterNode({ data }: { data: { label: string; subtitle: string } }) {
  return (
    <div className="rounded-lg border border-surface-500 bg-surface-700 px-3 py-2 shadow-lg min-w-[100px]">
      <Handle type="target" position={Position.Top} className="!bg-accent" />
      <div className="text-xs font-semibold text-gray-200 text-center">{data.label}</div>
      {data.subtitle && (
        <div className="text-sm text-gray-500 text-center mt-0.5">{data.subtitle}</div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-accent" />
    </div>
  )
}

const nodeTypes: NodeTypes = {
  character: CharacterNode
}

// ============================================================
// 主组件
// ============================================================

export function RelationGraph(): React.ReactElement {
  const currentProject = useProjectStore((s) => s.currentProject)
  const [characters, setCharacters] = useState<Character[]>([])

  useEffect(() => {
    if (!currentProject) return
    void loadCharacters()
  }, [currentProject?.id])

  async function loadCharacters(): Promise<void> {
    if (!currentProject) return
    const list = await window.api.world.listCharacters(currentProject.id)
    setCharacters(list)
  }

  // 将人物卡转换为 ReactFlow 节点和边
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = []
    const edges: Edge[] = []
    const charMap = new Map(characters.map((c) => [c.id, c]))

    // 布局：环形排列
    const cx = 300
    const cy = 250
    const radius = 180
    const count = characters.length || 1

    characters.forEach((char, i) => {
      const angle = (2 * Math.PI * i) / count - Math.PI / 2
      const x = cx + radius * Math.cos(angle)
      const y = cy + radius * Math.sin(angle)

      nodes.push({
        id: char.id,
        type: 'character',
        position: { x, y },
        data: {
          label: char.name,
          subtitle: char.aliases.length > 0 ? char.aliases[0] : ''
        }
      })

      // 关系 → 边
      for (const rel of char.relations) {
        if (charMap.has(rel.targetId)) {
          const edgeId = `${char.id}-${rel.targetId}`
          // 避免重复边
          if (!edges.find((e) => e.id === edgeId || e.id === `${rel.targetId}-${char.id}`)) {
            edges.push({
              id: edgeId,
              source: char.id,
              target: rel.targetId,
              label: rel.type || rel.note,
              style: { stroke: '#7c3aed', strokeWidth: 1.5 },
              labelStyle: { fill: '#94a3b8', fontSize: 10 },
              type: 'default'
            })
          }
        }
      }
    })

    return { initialNodes: nodes, initialEdges: edges }
  }, [characters])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // 当 characters 更新时重新设置节点
  useEffect(() => {
    setNodes(initialNodes)
    setEdges(initialEdges)
  }, [initialNodes, initialEdges, setNodes, setEdges])

  if (characters.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mb-2 flex justify-center text-gray-500"><IconNetwork size={32} /></div>
          <p className="text-xs text-gray-500">暂无人物关系</p>
          <p className="text-sm text-gray-600 mt-1">
            添加人物卡并设置关系后，此处将显示关系图
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
        proOptions={{ hideAttribution: true }}
        style={{ background: '#111113' }}
      >
        <Background color="#303033" gap={20} />
        <Controls
          showInteractive={false}
          style={{ background: '#222225', borderColor: '#303033' }}
        />
      </ReactFlow>
    </div>
  )
}
