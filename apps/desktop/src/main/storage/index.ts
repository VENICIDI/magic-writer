/**
 * Magic Writer · Storage Module (better-sqlite3)
 *
 * 替代原有的 JSON 占位实现，使用 SQLite + Markdown 文件混合存储。
 * - 元数据（项目/卷/章节/人物/伏笔）→ SQLite
 * - 章节正文 → Markdown 文件（保持可读性、版本控制友好）
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs'
import { join } from 'path'
import {
  countWords,
  type Chapter,
  type Character,
  type Entity,
  type Foreshadowing,
  type Project,
  type Volume
} from '@magic-writer/shared'
import { getDB, getDataDir } from './database'
import { indexChapter } from '../agents/rag-engine'
import {
  deleteEntity,
  deleteRelationsFrom,
  listEntities,
  listRelations,
  upsertEntity,
  upsertRelation
} from './entities'

export * from './entities'

// ============================================================
// 项目
// ============================================================

export function listProjects(): Project[] {
  const db = getDB()
  const rows = db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all() as any[]
  return rows.map(rowToProject)
}

export function getProject(id: string): Project | null {
  const db = getDB()
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any
  return row ? rowToProject(row) : null
}

export function createProject(input: {
  title: string
  genre: string
  logline: string
}): Project {
  const db = getDB()
  const now = Date.now()
  const id = `p-${now}`
  db.prepare(`
    INSERT INTO projects (id, title, genre, logline, root_path, created_at, updated_at)
    VALUES (?, ?, ?, ?, '', ?, ?)
  `).run(id, input.title, input.genre, input.logline, now, now)
  return { id, title: input.title, genre: input.genre, logline: input.logline, rootPath: '', createdAt: now, updatedAt: now }
}

export function deleteProject(id: string): void {
  const db = getDB()
  // 删除章节文件
  const chapterRows = db.prepare('SELECT file_path FROM chapters WHERE project_id = ?').all(id) as Array<{ file_path: string }>
  for (const row of chapterRows) {
    try {
      const { unlinkSync } = require('fs') as typeof import('fs')
      unlinkSync(join(getDataDir(), 'chapters', row.file_path))
    } catch { /* ignore */ }
  }
  // CASCADE 会处理 volumes/chapters/characters/foreshadowing/agent_sessions
  db.prepare('DELETE FROM projects WHERE id = ?').run(id)
}

function rowToProject(row: any): Project {
  return {
    id: row.id,
    title: row.title,
    genre: row.genre,
    logline: row.logline,
    rootPath: row.root_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

// ============================================================
// 卷
// ============================================================

export function listVolumes(projectId: string): Volume[] {
  const db = getDB()
  const rows = db.prepare('SELECT * FROM volumes WHERE project_id = ? ORDER BY sort_order').all(projectId) as any[]
  return rows.map(rowToVolume)
}

export function createVolume(projectId: string, title: string): Volume {
  const db = getDB()
  const id = `v-${Date.now()}`
  const maxOrder = (db.prepare('SELECT MAX(sort_order) as m FROM volumes WHERE project_id = ?').get(projectId) as any)?.m ?? 0
  db.prepare('INSERT INTO volumes (id, project_id, title, sort_order) VALUES (?, ?, ?, ?)').run(id, projectId, title, maxOrder + 1)
  return { id, projectId, title, order: maxOrder + 1 }
}

export function renameVolume(id: string, title: string): Volume | null {
  const db = getDB()
  const row = db.prepare('SELECT * FROM volumes WHERE id = ?').get(id) as any
  if (!row) return null
  db.prepare('UPDATE volumes SET title = ? WHERE id = ?').run(title, id)
  return { ...rowToVolume(row), title }
}

export function deleteVolume(id: string): void {
  const db = getDB()
  // 级联删除卷下的章节（SQLite ON DELETE CASCADE 已设置，但章节 md 文件也要清理）
  const chapterRows = db.prepare('SELECT file_path FROM chapters WHERE volume_id = ?').all(id) as Array<{ file_path: string }>
  for (const row of chapterRows) {
    try {
      const { unlinkSync } = require('fs') as typeof import('fs')
      unlinkSync(join(getDataDir(), 'chapters', row.file_path))
    } catch { /* 文件不存在也没关系 */ }
  }
  db.prepare('DELETE FROM chapters WHERE volume_id = ?').run(id)
  db.prepare('DELETE FROM volumes WHERE id = ?').run(id)
}

function rowToVolume(row: any): Volume {
  return { id: row.id, projectId: row.project_id, title: row.title, order: row.sort_order }
}

// ============================================================
// 章节
// ============================================================

export function listChapters(projectId: string): { volumes: Volume[]; chapters: Chapter[] } {
  return {
    volumes: listVolumes(projectId),
    chapters: listChaptersByProject(projectId)
  }
}

function listChaptersByProject(projectId: string): Chapter[] {
  const db = getDB()
  const rows = db.prepare('SELECT * FROM chapters WHERE project_id = ? ORDER BY sort_order').all(projectId) as any[]
  return rows.map(rowToChapter)
}

export function getChapterContent(chapterId: string): { chapter: Chapter; content: string } | null {
  const db = getDB()
  const row = db.prepare('SELECT * FROM chapters WHERE id = ?').get(chapterId) as any
  if (!row) return null
  const chapter = rowToChapter(row)
  const filePath = join(getDataDir(), 'chapters', chapter.filePath)
  const content = existsSync(filePath) ? readFileSync(filePath, 'utf-8') : ''
  return { chapter, content }
}

export function saveChapter(chapterId: string, content: string): Chapter | null {
  const db = getDB()
  const row = db.prepare('SELECT * FROM chapters WHERE id = ?').get(chapterId) as any
  if (!row) return null

  const filePath = join(getDataDir(), 'chapters', row.file_path)
  // 写盘前先留一份历史快照，防误改/丢稿
  writeChapterBackup(chapterId, content)
  writeFileSync(filePath, content, 'utf-8')

  const wordCount = countWords(content)
  const now = Date.now()
  db.prepare('UPDATE chapters SET word_count = ?, updated_at = ? WHERE id = ?').run(wordCount, now, chapterId)

  // 更新 FTS 索引
  updateFTS(chapterId, content)

  // 异步更新 RAG 向量索引（不阻塞保存）
  indexChapter(row.project_id, chapterId, content).catch(() => {})

  return { ...rowToChapter(row), wordCount, updatedAt: now }
}

export function createChapter(input: {
  projectId: string
  volumeId: string
  title: string
}): Chapter {
  const db = getDB()
  const now = Date.now()
  const id = `c-${now}`
  const filePath = `${id}.txt`
  const maxOrder = (db.prepare('SELECT MAX(sort_order) as m FROM chapters WHERE volume_id = ?').get(input.volumeId) as any)?.m ?? 0
  const order = maxOrder + 1

  db.prepare(`
    INSERT INTO chapters (id, project_id, volume_id, title, file_path, outline, word_count, status, sort_order, updated_at)
    VALUES (?, ?, ?, ?, ?, '', 0, 'draft', ?, ?)
  `).run(id, input.projectId, input.volumeId, input.title, filePath, order, now)

  const fullPath = join(getDataDir(), 'chapters', filePath)
  writeFileSync(fullPath, '', 'utf-8')

  return {
    id,
    projectId: input.projectId,
    volumeId: input.volumeId,
    title: input.title,
    filePath,
    outline: '',
    wordCount: 0,
    status: 'draft',
    order,
    updatedAt: now
  }
}

export function renameChapter(id: string, title: string): Chapter | null {
  const db = getDB()
  const row = db.prepare('SELECT * FROM chapters WHERE id = ?').get(id) as any
  if (!row) return null
  db.prepare('UPDATE chapters SET title = ? WHERE id = ?').run(title, id)
  return { ...rowToChapter(row), title }
}

export function deleteChapter(id: string): void {
  const db = getDB()
  const row = db.prepare('SELECT file_path FROM chapters WHERE id = ?').get(id) as any
  if (!row) return
  // 删除 md 文件
  try {
    const { unlinkSync } = require('fs') as typeof import('fs')
    unlinkSync(join(getDataDir(), 'chapters', row.file_path))
  } catch { /* ignore */ }
  // 删除 FTS 索引
  db.prepare('DELETE FROM chapters_fts WHERE chapter_id = ?').run(id)
  // 删除记录
  db.prepare('DELETE FROM chapters WHERE id = ?').run(id)
}

function rowToChapter(row: any): Chapter {
  return {
    id: row.id,
    projectId: row.project_id,
    volumeId: row.volume_id,
    title: row.title,
    filePath: row.file_path,
    outline: row.outline,
    wordCount: row.word_count,
    status: row.status,
    order: row.sort_order,
    updatedAt: row.updated_at
  }
}

// ============================================================
// 人物卡
// ============================================================

// 人物现已统一存储于 entities 表（type='character'），relations 拆入 entity_relations。
// 以下函数作为「统一实体层」的适配器，保持原有 Character 视图与 IPC 行为不变。

export function listCharacters(projectId: string): Character[] {
  const entities = listEntities(projectId, 'character')
  const relations = listRelations(projectId)
  return entities.map((e) => entityToCharacter(e, relations.filter((r) => r.fromId === e.id)))
}

export function upsertCharacter(character: Character): Character {
  const data = {
    aliases: character.aliases,
    age: character.age,
    appearance: character.appearance,
    personality: character.personality,
    abilities: character.abilities,
    firstAppearChapterId: character.firstAppearChapterId,
    lockedFields: character.lockedFields
  }
  upsertEntity({
    id: character.id,
    projectId: character.projectId,
    type: 'character',
    name: character.name,
    summary: character.personality,
    data
  })

  // 同步人物卡的出向关系到统一关系表（人物卡「拥有」其 relations 列表）
  deleteRelationsFrom(character.id)
  for (const rel of character.relations) {
    upsertRelation({
      projectId: character.projectId,
      fromId: character.id,
      fromType: 'character',
      toId: rel.targetId,
      toType: 'character',
      type: rel.type,
      note: rel.note
    })
  }

  return character
}

export function deleteCharacter(id: string): void {
  deleteEntity(id)
}

function entityToCharacter(
  e: Entity,
  outgoing: Array<{ toId: string; type: string; note: string }>
): Character {
  const data = e.data as {
    aliases?: string[]
    age?: number
    appearance?: string
    personality?: string
    abilities?: string[]
    firstAppearChapterId?: string
    lockedFields?: string[]
  }
  return {
    id: e.id,
    projectId: e.projectId,
    name: e.name,
    aliases: data.aliases ?? [],
    age: data.age,
    appearance: data.appearance ?? '',
    personality: data.personality ?? '',
    abilities: data.abilities ?? [],
    relations: outgoing.map((r) => ({ targetId: r.toId, type: r.type, note: r.note })),
    firstAppearChapterId: data.firstAppearChapterId,
    lockedFields: data.lockedFields ?? []
  }
}

// ============================================================
// 伏笔
// ============================================================

// 伏笔现已统一存储于 entities 表（type='foreshadowing'），plantedAt/resolvedAt/status 存于 data。

export function listForeshadowing(projectId: string): Foreshadowing[] {
  return listEntities(projectId, 'foreshadowing').map(entityToForeshadowing)
}

export function upsertForeshadowing(item: Foreshadowing): Foreshadowing {
  upsertEntity({
    id: item.id,
    projectId: item.projectId,
    type: 'foreshadowing',
    name: item.description,
    summary: item.description,
    data: {
      plantedAt: item.plantedAt,
      resolvedAt: item.resolvedAt,
      status: item.status
    }
  })
  return item
}

function entityToForeshadowing(e: Entity): Foreshadowing {
  const data = e.data as {
    plantedAt?: { chapterId: string; offset: number }
    resolvedAt?: { chapterId: string; offset: number }
    status?: Foreshadowing['status']
  }
  return {
    id: e.id,
    projectId: e.projectId,
    description: e.name,
    plantedAt: data.plantedAt ?? { chapterId: '', offset: 0 },
    resolvedAt: data.resolvedAt,
    status: data.status ?? 'pending'
  }
}

// ============================================================
// 全文搜索
// ============================================================

export function searchChapters(projectId: string, query: string): Array<{ chapterId: string; snippet: string }> {
  const db = getDB()
  const rows = db.prepare(`
    SELECT chapter_id, snippet(chapters_fts, 1, '<b>', '</b>', '…', 32) as snippet
    FROM chapters_fts
    WHERE chapters_fts MATCH ?
    ORDER BY rank
    LIMIT 20
  `).all(query) as any[]

  // 过滤当前项目的章节
  const projectChapterIds = new Set(
    (db.prepare('SELECT id FROM chapters WHERE project_id = ?').all(projectId) as any[]).map(r => r.id)
  )
  return rows
    .filter(r => projectChapterIds.has(r.chapter_id))
    .map(r => ({ chapterId: r.chapter_id, snippet: r.snippet }))
}

function updateFTS(chapterId: string, content: string): void {
  const db = getDB()
  // 先删旧记录
  db.prepare('DELETE FROM chapters_fts WHERE chapter_id = ?').run(chapterId)
  // 插入新记录
  if (content.trim()) {
    db.prepare('INSERT INTO chapters_fts (chapter_id, content) VALUES (?, ?)').run(chapterId, content)
  }
}

// ============================================================
// 设置
// ============================================================

export function getSetting<T>(key: string, defaultValue: T): T {
  const db = getDB()
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any
  if (!row) return defaultValue
  try {
    return JSON.parse(row.value) as T
  } catch {
    return defaultValue
  }
}

export function setSetting<T>(key: string, value: T): void {
  const db = getDB()
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, JSON.stringify(value))
}

// ============================================================
// Seed 演示数据
// ============================================================

export function ensureSeedData(): void {
  const db = getDB()
  // 先把旧版 characters/foreshadowing 存量数据迁移到统一实体表（幂等）
  migrateLegacyEntities()

  const count = (db.prepare('SELECT COUNT(*) as c FROM projects').get() as any).c
  if (count > 0) return

  const now = Date.now()
  const projectId = 'demo-project'

  // 创建项目
  db.prepare(`
    INSERT INTO projects (id, title, genre, logline, root_path, created_at, updated_at)
    VALUES (?, ?, ?, ?, '', ?, ?)
  `).run(projectId, '我的修仙文', '玄幻修仙', '网文编辑穿越青云宗，以前世阅稿万卷之眼踏上修仙之路。', now, now)

  // 创建卷
  db.prepare('INSERT INTO volumes (id, project_id, title, sort_order) VALUES (?, ?, ?, ?)').run('v1', projectId, '卷一 · 觉醒', 1)
  db.prepare('INSERT INTO volumes (id, project_id, title, sort_order) VALUES (?, ?, ?, ?)').run('v2', projectId, '卷二 · 入世', 2)

  // 创建章节
  const chapters = [
    { id: 'c1', volumeId: 'v1', title: '第一章 穿越', file: 'c1.txt', outline: '主角穿越到修仙界，拥有前世记忆。', order: 1 },
    { id: 'c2', volumeId: 'v1', title: '第二章 觉醒', file: 'c2.txt', outline: '主角觉醒灵根，被青云宗收为外门弟子。', order: 2 },
    { id: 'c3', volumeId: 'v1', title: '第三章 初修', file: 'c3.txt', outline: '主角第一次尝试练气，展露不凡天资。', order: 3 },
    { id: 'c4', volumeId: 'v2', title: '第四章 下山', file: 'c4.txt', outline: '主角奉命下山历练。', order: 4 }
  ]

  const contents: Record<string, string> = {
    'c1.txt': `夜色如墨，星辰暗淡。

萧远睁开双眼的瞬间，入目的是一片陌生的木质天花板。淡淡的檀香混合着某种不知名的药草气息，弥漫在狭小的房间里。

他感觉浑身酸痛，仿佛被人从高处狠狠摔下。脑海中有一股陌生的记忆如潮水般涌来——前世今生，两段人生在意识中激烈碰撞。

"这是……修仙界？"
`,
    'c2.txt': '',
    'c3.txt': '',
    'c4.txt': ''
  }

  const insertChapter = db.prepare(`
    INSERT INTO chapters (id, project_id, volume_id, title, file_path, outline, word_count, status, sort_order, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)
  `)

  for (const c of chapters) {
    const content = contents[c.file] ?? ''
    const wc = countWords(content)
    insertChapter.run(c.id, projectId, c.volumeId, c.title, c.file, c.outline, wc, c.order, now)
    writeFileSync(join(getDataDir(), 'chapters', c.file), content, 'utf-8')
    // FTS 索引
    if (content.trim()) {
      db.prepare('INSERT INTO chapters_fts (chapter_id, content) VALUES (?, ?)').run(c.id, content)
    }
  }

  // 创建示例人物卡（写入统一实体表）
  upsertCharacter({
    id: 'char-1',
    projectId,
    name: '萧远',
    aliases: ['远哥', '萧师兄'],
    age: 18,
    appearance: '身形修长，面容清秀，目光深邃如含星辰',
    personality: '沉稳内敛，外冷内热，前世阅稿万卷赋予他对情节走向的敏锐直觉',
    abilities: ['阅稿万卷之眼', '寒冰剑诀'],
    relations: [],
    lockedFields: ['personality']
  })
}

// ============================================================
// 旧版实体数据迁移（characters / foreshadowing -> entities）
// ============================================================

export function migrateLegacyEntities(): void {
  const db = getDB()
  if (getSetting('legacy_entities_migrated', false)) return

  // 旧 characters 表 -> entities(type='character') + entity_relations
  if (legacyTableExists('characters')) {
    const rows = db.prepare('SELECT * FROM characters').all() as any[]
    for (const row of rows) {
      upsertCharacter({
        id: row.id,
        projectId: row.project_id,
        name: row.name,
        aliases: safeJSON(row.aliases, []),
        age: row.age ?? undefined,
        appearance: row.appearance ?? '',
        personality: row.personality ?? '',
        abilities: safeJSON(row.abilities, []),
        relations: safeJSON(row.relations, []),
        firstAppearChapterId: row.first_appear_chapter_id ?? undefined,
        lockedFields: safeJSON(row.locked_fields, [])
      })
    }
  }

  // 旧 foreshadowing 表 -> entities(type='foreshadowing')
  if (legacyTableExists('foreshadowing')) {
    const rows = db.prepare('SELECT * FROM foreshadowing').all() as any[]
    for (const row of rows) {
      upsertForeshadowing({
        id: row.id,
        projectId: row.project_id,
        description: row.description,
        plantedAt: safeJSON(row.planted_at, { chapterId: '', offset: 0 }),
        resolvedAt: row.resolved_at ? safeJSON(row.resolved_at, undefined) : undefined,
        status: row.status ?? 'pending'
      })
    }
  }

  setSetting('legacy_entities_migrated', true)
}

function legacyTableExists(name: string): boolean {
  const db = getDB()
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
    .get(name)
  return !!row
}

function safeJSON<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

// ============================================================
// 章节版本快照（落盘备份，防误改/丢稿）
// ============================================================

const MAX_BACKUPS_PER_CHAPTER = 20

function backupDir(chapterId: string): string {
  const dir = join(getDataDir(), 'backups', chapterId)
  mkdirSync(dir, { recursive: true })
  return dir
}

/** 保存章节前写一份带时间戳的快照，并仅保留最近 N 份 */
function writeChapterBackup(chapterId: string, content: string): void {
  try {
    // 空内容不备份，避免覆盖型误删后快照也变空
    if (!content.trim()) return
    const dir = backupDir(chapterId)
    const file = `${Date.now()}.txt`
    writeFileSync(join(dir, file), content, 'utf-8')

    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.txt'))
      .sort()
    const excess = files.length - MAX_BACKUPS_PER_CHAPTER
    for (let i = 0; i < excess; i++) {
      try {
        unlinkSync(join(dir, files[i]))
      } catch {
        /* ignore */
      }
    }
  } catch {
    // 备份失败不阻塞正常保存
  }
}

export function listChapterBackups(
  chapterId: string
): Array<{ file: string; createdAt: number }> {
  try {
    const dir = join(getDataDir(), 'backups', chapterId)
    if (!existsSync(dir)) return []
    return readdirSync(dir)
      .filter((f) => f.endsWith('.txt'))
      .map((f) => ({ file: f, createdAt: Number(f.replace('.txt', '')) || 0 }))
      .sort((a, b) => b.createdAt - a.createdAt)
  } catch {
    return []
  }
}

export function readChapterBackup(chapterId: string, file: string): string | null {
  try {
    // 防目录穿越：只接受纯文件名
    if (file.includes('/') || file.includes('\\') || file.includes('..')) return null
    const path = join(getDataDir(), 'backups', chapterId, file)
    return existsSync(path) ? readFileSync(path, 'utf-8') : null
  } catch {
    return null
  }
}
