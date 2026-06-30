import { useCallback, useEffect, useRef, useState } from 'react'
import type { Entity, LocationData } from '@magic-writer/shared'
import { useProjectStore } from '../stores/project'
import {
  IconMap,
  IconMapPin,
  IconUpload,
  IconImage,
  IconZoomIn,
  IconZoomOut,
  IconMaximize,
  IconPlus,
  IconX,
  IconTrash,
  IconSparkles
} from './Icons'

// ============================================================
// 地图 Tab：架空世界的「空间沙盘」
// 上传底图图片，把作品里的「地点」实体钉到图上、定位并查看/编辑设定。
// 与「图谱」数据同源（统一实体层 type='location'），仅视图不同：
// 图谱是抽象关系网络，地图是空间地理布局。
// ============================================================

/** 每个作品的地图元数据（底图文件名 + 当前润色滤镜），存于 settings。 */
interface MapMeta {
  fileName: string
  filterPreset: string
}

/**
 * 「AI 润色」滤镜预设。
 *
 * 诚实说明：当前项目的 LLM 网关（packages/llm-gateway）只支持纯文本的
 * OpenAI 兼容 chat 协议，没有图像生成/图生图能力，因此这里的「润色」是
 * 纯前端 CSS 滤镜（对比度/做旧/色调），属于即时图像增强，而非生成式重绘。
 * TODO(真实 AI 出图)：若后续接入图像模型（如 SD/DALL·E 图生图），可在此
 * 处新增一个走 IPC 的「风格重绘」入口，把底图发给图像模型并落盘新底图。
 */
interface FilterPreset {
  id: string
  label: string
  desc: string
  filter: string
  /** 是否叠加羊皮纸纸张质感层 */
  parchment?: boolean
}

const FILTER_PRESETS: FilterPreset[] = [
  { id: 'none', label: '原图', desc: '不做任何处理', filter: 'none' },
  {
    id: 'parchment',
    label: '羊皮纸做旧',
    desc: '泛黄做旧 + 纸张质感',
    filter: 'sepia(0.55) contrast(1.05) brightness(1.05) saturate(0.85)',
    parchment: true
  },
  {
    id: 'antique',
    label: '古地图墨调',
    desc: '低饱和偏暖旧墨色',
    filter: 'sepia(0.35) contrast(1.15) saturate(0.7) brightness(0.98)'
  },
  {
    id: 'ink',
    label: '高对比墨线',
    desc: '强化线条、弱化色彩',
    filter: 'grayscale(0.4) contrast(1.4) brightness(1.02)'
  },
  {
    id: 'night',
    label: '冷色夜图',
    desc: '偏冷暗调、夜间氛围',
    filter: 'brightness(0.82) contrast(1.12) saturate(1.1) hue-rotate(-12deg)'
  },
  {
    id: 'emerald',
    label: '翡翠幽光',
    desc: '偏青绿奇幻色调',
    filter: 'contrast(1.1) saturate(1.15) hue-rotate(110deg) brightness(0.95)'
  }
]

interface Transform {
  scale: number
  tx: number
  ty: number
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function mapMetaKey(projectId: string): string {
  return `map.meta.${projectId}`
}

function locData(e: Entity): LocationData {
  return (e.data ?? {}) as LocationData
}

function isPlaced(e: Entity): boolean {
  const d = locData(e)
  return typeof d.mapX === 'number' && typeof d.mapY === 'number'
}

/** ArrayBuffer -> base64（分块避免超长 apply 栈溢出） */
function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export function MapView(): React.ReactElement {
  const currentProject = useProjectStore((s) => s.currentProject)
  const projectId = currentProject?.id ?? ''

  const [locations, setLocations] = useState<Entity[]>([])
  const [meta, setMeta] = useState<MapMeta | null>(null)
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [loadingImage, setLoadingImage] = useState(false)
  const [transform, setTransform] = useState<Transform>({ scale: 1, tx: 0, ty: 0 })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const viewportRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const panRef = useRef<{ startX: number; startY: number; tx0: number; ty0: number } | null>(null)
  const pinDragRef = useRef<{ id: string; moved: boolean } | null>(null)

  const preset = FILTER_PRESETS.find((p) => p.id === (meta?.filterPreset ?? 'none')) ?? FILTER_PRESETS[0]

  // ---------- 数据加载 ----------
  const reload = useCallback(async (): Promise<void> => {
    if (!projectId) return
    const locs = await window.api.entity.list(projectId, 'location')
    setLocations(locs)
  }, [projectId])

  useEffect(() => {
    if (!projectId) return
    setSelectedId(null)
    void reload()
    void (async () => {
      const stored = await window.api.settings.get<MapMeta | null>(mapMetaKey(projectId), null)
      setMeta(stored)
    })()
  }, [projectId, reload])

  // 底图文件名变化时载入图片（转 data:URL）
  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!meta?.fileName) {
        setDataUrl(null)
        return
      }
      setLoadingImage(true)
      const res = await window.api.map.readImage(meta.fileName)
      if (!cancelled) {
        setDataUrl(res.dataUrl)
        setLoadingImage(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [meta?.fileName])

  // ---------- 视图：缩放（非被动 wheel 监听，可 preventDefault） ----------
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault()
      const rect = vp.getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      setTransform((t) => {
        const factor = Math.exp(-e.deltaY * 0.0015)
        const newScale = clamp(t.scale * factor, 0.2, 8)
        const k = newScale / t.scale
        return { scale: newScale, tx: px - (px - t.tx) * k, ty: py - (py - t.ty) * k }
      })
    }
    vp.addEventListener('wheel', onWheel, { passive: false })
    return () => vp.removeEventListener('wheel', onWheel)
  }, [])

  const fitView = useCallback((): void => {
    const vp = viewportRef.current
    const img = imgRef.current
    if (!vp || !img || !img.naturalWidth || !img.naturalHeight) return
    const scale = Math.min(vp.clientWidth / img.naturalWidth, vp.clientHeight / img.naturalHeight) * 0.92
    setTransform({
      scale,
      tx: (vp.clientWidth - img.naturalWidth * scale) / 2,
      ty: (vp.clientHeight - img.naturalHeight * scale) / 2
    })
  }, [])

  function zoomBy(factor: number): void {
    const vp = viewportRef.current
    if (!vp) return
    const px = vp.clientWidth / 2
    const py = vp.clientHeight / 2
    setTransform((t) => {
      const newScale = clamp(t.scale * factor, 0.2, 8)
      const k = newScale / t.scale
      return { scale: newScale, tx: px - (px - t.tx) * k, ty: py - (py - t.ty) * k }
    })
  }

  // ---------- 视图：平移（在空白底图上拖拽） ----------
  function onViewportPointerDown(e: React.PointerEvent): void {
    if (e.button !== 0) return
    panRef.current = { startX: e.clientX, startY: e.clientY, tx0: transform.tx, ty0: transform.ty }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  function onViewportPointerMove(e: React.PointerEvent): void {
    const pan = panRef.current
    if (!pan) return
    const dx = e.clientX - pan.startX
    const dy = e.clientY - pan.startY
    setTransform((t) => ({ ...t, tx: pan.tx0 + dx, ty: pan.ty0 + dy }))
  }
  function onViewportPointerUp(e: React.PointerEvent): void {
    panRef.current = null
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  /** 屏幕坐标 -> 底图归一化坐标（0~1）。getBoundingClientRect 已反映缩放/平移。 */
  function clientToNorm(clientX: number, clientY: number): { x: number; y: number } | null {
    const img = imgRef.current
    if (!img) return null
    const r = img.getBoundingClientRect()
    if (!r.width || !r.height) return null
    return {
      x: clamp((clientX - r.left) / r.width, 0, 1),
      y: clamp((clientY - r.top) / r.height, 0, 1)
    }
  }

  // ---------- 地点写入（保留其余 data 字段，仅合并 patch） ----------
  const patchLocation = useCallback(
    async (loc: Entity, patch: Partial<LocationData>, name?: string): Promise<void> => {
      if (!projectId) return
      const data: Record<string, unknown> = { ...locData(loc), ...patch }
      await window.api.entity.upsert({
        id: loc.id,
        projectId,
        type: 'location',
        name: name ?? loc.name,
        summary: loc.summary,
        data
      })
      await reload()
    },
    [projectId, reload]
  )

  // ---------- 图钉拖动（重新定位） ----------
  function onPinPointerDown(e: React.PointerEvent, loc: Entity): void {
    e.stopPropagation()
    e.preventDefault()
    pinDragRef.current = { id: loc.id, moved: false }
    const move = (ev: PointerEvent): void => {
      const n = clientToNorm(ev.clientX, ev.clientY)
      if (!n) return
      pinDragRef.current = { id: loc.id, moved: true }
      setLocations((prev) =>
        prev.map((l) => (l.id === loc.id ? { ...l, data: { ...locData(l), mapX: n.x, mapY: n.y } } : l))
      )
    }
    const up = (ev: PointerEvent): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      const dragged = pinDragRef.current?.moved
      pinDragRef.current = null
      if (dragged) {
        const n = clientToNorm(ev.clientX, ev.clientY)
        if (n) void patchLocation(loc, { mapX: n.x, mapY: n.y })
      } else {
        setSelectedId(loc.id)
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // ---------- 从左侧列表拖放地点到底图 ----------
  function onDrop(e: React.DragEvent): void {
    e.preventDefault()
    setDragOver(false)
    const id = e.dataTransfer.getData('text/plain')
    const loc = locations.find((l) => l.id === id)
    if (!loc) return
    const n = clientToNorm(e.clientX, e.clientY)
    if (!n) return
    void patchLocation(loc, { mapX: n.x, mapY: n.y })
  }

  // ---------- 上传 / 更换底图 ----------
  function onPickFile(): void {
    fileInputRef.current?.click()
  }
  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0]
    e.target.value = '' // 允许再次选择同一文件
    if (!file || !projectId) return
    setLoadingImage(true)
    const buf = await file.arrayBuffer()
    const base64 = arrayBufferToBase64(buf)
    const ext = file.name.split('.').pop() || 'png'
    if (meta?.fileName) await window.api.map.deleteImage(meta.fileName)
    const { fileName } = await window.api.map.saveImage({ projectId, dataBase64: base64, ext })
    const newMeta: MapMeta = { fileName, filterPreset: meta?.filterPreset ?? 'none' }
    await window.api.settings.set(mapMetaKey(projectId), newMeta)
    setMeta(newMeta)
  }

  async function setFilterPreset(id: string): Promise<void> {
    if (!projectId || !meta) return
    const newMeta: MapMeta = { ...meta, filterPreset: id }
    await window.api.settings.set(mapMetaKey(projectId), newMeta)
    setMeta(newMeta)
  }

  // ---------- 新建地点 ----------
  async function createLocation(placeOnMap: boolean): Promise<void> {
    if (!projectId || !newName.trim()) return
    const data: Record<string, unknown> = placeOnMap ? { mapX: 0.5, mapY: 0.5 } : {}
    const created = await window.api.entity.upsert({
      projectId,
      type: 'location',
      name: newName.trim(),
      data
    })
    setNewName('')
    setCreating(false)
    await reload()
    if (placeOnMap) setSelectedId(created.id)
  }

  async function removeFromMap(loc: Entity): Promise<void> {
    await patchLocation(loc, { mapX: undefined, mapY: undefined })
  }

  async function deleteLocation(loc: Entity): Promise<void> {
    await window.api.entity.delete(loc.id)
    if (selectedId === loc.id) setSelectedId(null)
    await reload()
  }

  const placed = locations.filter(isPlaced)
  const unplaced = locations.filter((l) => !isPlaced(l))
  const selected = selectedId ? locations.find((l) => l.id === selectedId) ?? null : null

  if (!currentProject) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500">请先打开一个作品</div>
    )
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-surface-900">
      {/* ===== 左侧：底图操作 + 地点列表 + 润色 ===== */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-surface-600 bg-surface-800">
        <div className="flex items-center gap-1.5 border-b border-surface-600 px-3 py-2.5 text-sm font-semibold text-gray-300">
          <IconMap size={15} /> 地图
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* 底图上传 */}
          <section className="border-b border-surface-600 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">
              <IconImage size={12} /> 底图
            </div>
            <button
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-surface-600 bg-surface-700 py-1.5 text-xs text-gray-300 hover:border-accent hover:text-accent-light"
              onClick={onPickFile}
            >
              <IconUpload size={13} />
              {meta?.fileName ? '更换底图' : '上传底图图片'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void onFileChange(e)}
            />
            <p className="mt-1.5 text-[11px] leading-4 text-gray-600">
              支持 PNG/JPG/WebP，图片会保存在本地作品数据中。
            </p>
          </section>

          {/* AI 润色（诚实声明：图像滤镜，非生成式重绘） */}
          <section className="border-b border-surface-600 p-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">
              <IconSparkles size={12} /> AI 润色
            </div>
            <p className="mb-2 text-[11px] leading-4 text-gray-600">
              当前为图像滤镜效果（对比度 / 做旧 / 色调），<span className="text-gray-500">非 AI 生成式重绘</span>。
            </p>
            <div className="grid grid-cols-2 gap-1">
              {FILTER_PRESETS.map((p) => {
                const active = preset.id === p.id
                return (
                  <button
                    key={p.id}
                    disabled={!meta?.fileName}
                    title={p.desc}
                    onClick={() => void setFilterPreset(p.id)}
                    className={`rounded-md border px-2 py-1 text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      active
                        ? 'border-accent bg-accent-15 text-accent-light'
                        : 'border-surface-600 bg-surface-700 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>
            <button
              disabled
              title="待接入图像生成模型后可用（当前 LLM 网关仅支持文本）"
              className="mt-2 flex w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-md border border-dashed border-surface-600 py-1.5 text-[11px] text-gray-600"
            >
              <IconSparkles size={12} /> AI 风格重绘（待接入）
            </button>
          </section>

          {/* 地点列表：未放置（可拖到图上） */}
          <section className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">
                <IconMapPin size={12} /> 地点
              </span>
              <button
                className="rounded p-0.5 text-accent-light hover:bg-surface-700"
                title="新建地点"
                onClick={() => setCreating((v) => !v)}
              >
                <IconPlus size={13} />
              </button>
            </div>

            {creating && (
              <div className="mb-2 space-y-1.5">
                <input
                  autoFocus
                  className="input-field !py-1 !text-xs"
                  placeholder="地点名，如青云宗/落日城"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void createLocation(true)
                    if (e.key === 'Escape') setCreating(false)
                  }}
                />
                <div className="flex gap-1">
                  <button
                    className="flex-1 rounded bg-accent px-2 py-1 text-[11px] text-on-accent hover:bg-accent-80"
                    onClick={() => void createLocation(true)}
                  >
                    建并放到图上
                  </button>
                  <button
                    className="rounded border border-surface-600 px-2 py-1 text-[11px] text-gray-400 hover:text-gray-200"
                    onClick={() => void createLocation(false)}
                  >
                    仅新建
                  </button>
                </div>
              </div>
            )}

            {unplaced.length > 0 && (
              <div className="mb-3">
                <div className="mb-1 text-[10px] uppercase tracking-wide text-gray-600">未放置</div>
                <div className="space-y-1">
                  {unplaced.map((loc) => (
                    <div
                      key={loc.id}
                      draggable={!!meta?.fileName}
                      onDragStart={(e) => e.dataTransfer.setData('text/plain', loc.id)}
                      className={`group flex items-center gap-2 rounded-lg border border-surface-600 bg-surface-700 px-2 py-1.5 text-xs text-gray-300 ${
                        meta?.fileName ? 'cursor-grab active:cursor-grabbing' : ''
                      }`}
                      title={meta?.fileName ? '拖到底图上放置，或点右侧按钮放到中心' : '请先上传底图'}
                    >
                      <IconMapPin size={13} className="shrink-0 text-gray-500" />
                      <span className="flex-1 truncate">{loc.name || '未命名'}</span>
                      <button
                        disabled={!meta?.fileName}
                        className="rounded p-0.5 text-gray-600 opacity-0 transition-opacity hover:text-accent-light group-hover:opacity-100 disabled:opacity-0"
                        title="放到底图中心"
                        onClick={() => void patchLocation(loc, { mapX: 0.5, mapY: 0.5 })}
                      >
                        <IconPlus size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {placed.length > 0 && (
              <div>
                <div className="mb-1 text-[10px] uppercase tracking-wide text-gray-600">
                  已放置（{placed.length}）
                </div>
                <div className="space-y-1">
                  {placed.map((loc) => (
                    <button
                      key={loc.id}
                      onClick={() => setSelectedId(loc.id)}
                      className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-xs transition-colors ${
                        selectedId === loc.id
                          ? 'border-accent bg-accent-15 text-gray-100'
                          : 'border-surface-600 bg-surface-700 text-gray-300'
                      }`}
                    >
                      <IconMapPin size={13} className="shrink-0 text-accent-light" />
                      <span className="flex-1 truncate text-left">{loc.name || '未命名'}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {locations.length === 0 && !creating && (
              <p className="text-[11px] leading-5 text-gray-600">
                还没有地点。点上方「+」新建，或在「图谱 / 世界观」里创建的地点会自动出现在这里。
              </p>
            )}
          </section>
        </div>
      </aside>

      {/* ===== 中间：底图画布 ===== */}
      <div
        ref={viewportRef}
        className="relative flex-1 overflow-hidden bg-surface-900"
        onPointerDown={onViewportPointerDown}
        onPointerMove={onViewportPointerMove}
        onPointerUp={onViewportPointerUp}
        onDragOver={(e) => {
          e.preventDefault()
          if (!dragOver) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        style={{ cursor: panRef.current ? 'grabbing' : 'grab' }}
      >
        {!meta?.fileName ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mb-2 flex justify-center text-gray-600">
                <IconMap size={36} />
              </div>
              <p className="text-sm text-gray-400">还没有底图</p>
              <p className="mt-1 text-xs text-gray-600">上传一张地图图片，开始把地点钉到世界里</p>
              <button
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs text-on-accent hover:bg-accent-80"
                onClick={onPickFile}
              >
                <IconUpload size={13} /> 上传底图
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* 变换层：translate + scale，图钉作为底图子元素自动跟随 */}
            <div
              className="absolute left-0 top-0 origin-top-left"
              style={{ transform: `translate(${transform.tx}px, ${transform.ty}px) scale(${transform.scale})` }}
            >
              <div className="relative select-none">
                {dataUrl && (
                  <img
                    ref={imgRef}
                    src={dataUrl}
                    alt="地图底图"
                    draggable={false}
                    onLoad={fitView}
                    className="block max-w-none"
                    style={{ filter: preset.filter }}
                  />
                )}
                {/* 羊皮纸纸张质感叠层 */}
                {preset.parchment && (
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        'radial-gradient(120% 120% at 50% 50%, rgba(120,90,40,0) 55%, rgba(90,60,20,0.35) 100%)',
                      mixBlendMode: 'multiply'
                    }}
                  />
                )}

                {/* 图钉：counter-scale 保持恒定视觉大小 */}
                {placed.map((loc) => {
                  const d = locData(loc)
                  const active = selectedId === loc.id
                  return (
                    <div
                      key={loc.id}
                      className="absolute"
                      style={{
                        left: `${(d.mapX ?? 0.5) * 100}%`,
                        top: `${(d.mapY ?? 0.5) * 100}%`,
                        transform: `translate(-50%, -100%) scale(${1 / transform.scale})`,
                        transformOrigin: '50% 100%'
                      }}
                      onPointerDown={(e) => onPinPointerDown(e, loc)}
                    >
                      <div className="flex cursor-grab flex-col items-center active:cursor-grabbing">
                        <div
                          className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium shadow-lg ${
                            active
                              ? 'bg-accent text-on-accent'
                              : 'bg-surface-700/95 text-gray-200 ring-1 ring-surface-600'
                          }`}
                        >
                          {loc.name || '未命名'}
                        </div>
                        <IconMapPin
                          size={22}
                          className={active ? 'text-accent drop-shadow' : 'text-accent-light drop-shadow'}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 拖放高亮提示 */}
            {dragOver && (
              <div className="pointer-events-none absolute inset-0 border-2 border-dashed border-accent/60 bg-accent-10" />
            )}

            {/* 缩放控件 */}
            <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-lg border border-surface-600 bg-surface-800/90 p-1">
              <button
                className="rounded p-1 text-gray-400 hover:bg-surface-700 hover:text-gray-200"
                title="放大"
                onClick={() => zoomBy(1.2)}
              >
                <IconZoomIn size={15} />
              </button>
              <button
                className="rounded p-1 text-gray-400 hover:bg-surface-700 hover:text-gray-200"
                title="缩小"
                onClick={() => zoomBy(1 / 1.2)}
              >
                <IconZoomOut size={15} />
              </button>
              <button
                className="rounded p-1 text-gray-400 hover:bg-surface-700 hover:text-gray-200"
                title="适配窗口"
                onClick={fitView}
              >
                <IconMaximize size={15} />
              </button>
              <span className="px-1 text-[11px] tabular-nums text-gray-500">
                {Math.round(transform.scale * 100)}%
              </span>
            </div>

            {loadingImage && (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500">
                底图加载中…
              </div>
            )}
          </>
        )}
      </div>

      {/* ===== 右侧：地点详情（复用 location 字段，走 entity.upsert） ===== */}
      {selected && (
        <LocationDetail
          key={selected.id}
          loc={selected}
          onClose={() => setSelectedId(null)}
          onSave={(patch, name) => patchLocation(selected, patch, name)}
          onRemoveFromMap={() => removeFromMap(selected)}
          onDelete={() => deleteLocation(selected)}
        />
      )}
    </div>
  )
}

// ============================================================
// 右侧详情卡：编辑地点 name/region/description/significance
// ============================================================

function LocationDetail({
  loc,
  onClose,
  onSave,
  onRemoveFromMap,
  onDelete
}: {
  loc: Entity
  onClose: () => void
  onSave: (patch: Partial<LocationData>, name: string) => Promise<void>
  onRemoveFromMap: () => Promise<void>
  onDelete: () => Promise<void>
}): React.ReactElement {
  const d = locData(loc)
  const [name, setName] = useState(loc.name)
  const [region, setRegion] = useState(d.region ?? '')
  const [description, setDescription] = useState(d.description ?? '')
  const [significance, setSignificance] = useState(d.significance ?? '')

  async function save(): Promise<void> {
    await onSave(
      { region: region.trim(), description, significance },
      name.trim() || '未命名'
    )
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-surface-600 bg-surface-800">
      <div className="flex items-center justify-between border-b border-surface-600 px-3 py-2.5">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-200">
          <IconMapPin size={14} className="text-accent-light" /> 地点详情
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
          <label className="mb-1 block text-xs text-gray-500">所属区域</label>
          <input
            className="input-field"
            placeholder="如：东域 / 青云山脉"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">描述</label>
          <textarea
            className="input-field resize-none"
            rows={4}
            placeholder="地貌、风物、氛围…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">剧情意义</label>
          <textarea
            className="input-field resize-none"
            rows={3}
            placeholder="此地在故事里的作用、发生过的关键事件…"
            value={significance}
            onChange={(e) => setSignificance(e.target.value)}
          />
        </div>
        <button
          className="w-full rounded-lg bg-accent py-1.5 text-xs text-on-accent hover:bg-accent-80"
          onClick={() => void save()}
        >
          保存
        </button>

        <button
          className="w-full rounded-lg border border-surface-600 py-1.5 text-xs text-gray-300 hover:bg-surface-700"
          onClick={() => void onRemoveFromMap()}
        >
          从地图上移除（保留地点）
        </button>
      </div>

      <div className="border-t border-surface-600 p-3">
        <button
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-surface-600 py-1.5 text-xs text-red-400 hover:bg-surface-700"
          onClick={() => void onDelete()}
        >
          <IconTrash size={13} /> 删除此地点
        </button>
      </div>
    </aside>
  )
}
