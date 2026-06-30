/**
 * Magic Writer · 地图底图存储
 *
 * 底图图片以二进制文件落盘到 userData/magic-writer-data/maps/，
 * 文件名与作品(project)绑定。renderer 无法直接读本地文件，故读取时
 * 统一转成 data:URL（base64）返回，避免 file:// 在 http 渲染源下被
 * webSecurity 拦截——这是当前项目最稳的本地图片加载方式。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { getDataDir } from './database'

const EXT_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  svg: 'image/svg+xml'
}

function mapsDir(): string {
  const dir = join(getDataDir(), 'maps')
  mkdirSync(dir, { recursive: true })
  return dir
}

/** 防目录穿越：仅接受不含路径分隔符与「..」的纯文件名 */
function isSafeName(fileName: string): boolean {
  return (
    !!fileName &&
    !fileName.includes('/') &&
    !fileName.includes('\\') &&
    !fileName.includes('..')
  )
}

/**
 * 保存底图：接收 base64（不含 data:URL 前缀）的图片数据，写盘并返回文件名。
 * 文件名带 projectId 前缀与时间戳，便于人工排查与按作品归属。
 */
export function saveMapImage(projectId: string, dataBase64: string, ext: string): { fileName: string } {
  const safeExt = (ext || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
  const safeProject = projectId.replace(/[^a-zA-Z0-9_-]/g, '') || 'project'
  const fileName = `${safeProject}-${Date.now()}.${safeExt}`
  const buf = Buffer.from(dataBase64, 'base64')
  writeFileSync(join(mapsDir(), fileName), buf)
  return { fileName }
}

/** 读取底图并转为可直接用于 <img src> 的 data:URL；文件不存在返回 null。 */
export function readMapImage(fileName: string): string | null {
  if (!isSafeName(fileName)) return null
  const path = join(mapsDir(), fileName)
  if (!existsSync(path)) return null
  const ext = fileName.split('.').pop()?.toLowerCase() ?? 'png'
  const mime = EXT_MIME[ext] ?? 'image/png'
  const b64 = readFileSync(path).toString('base64')
  return `data:${mime};base64,${b64}`
}

export function deleteMapImage(fileName: string): void {
  try {
    if (!isSafeName(fileName)) return
    unlinkSync(join(mapsDir(), fileName))
  } catch {
    /* 文件不存在也没关系 */
  }
}
