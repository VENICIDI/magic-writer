/**
 * Magic Writer · 统一实体层存储
 *
 * 单一多态 `entities` 表 + 统一 `entity_relations` 关系表，
 * 作为人物/事件/地点/道具/伏笔等实体的底层统一管理入口。
 */
import type { Entity, EntityRelation, EntityType } from '@magic-writer/shared'
import { getDB } from './database'

// ============================================================
// 实体 CRUD
// ============================================================

export function listEntities(projectId: string, type?: EntityType): Entity[] {
  const db = getDB()
  const rows = type
    ? (db
        .prepare(
          'SELECT * FROM entities WHERE project_id = ? AND type = ? ORDER BY sort_order, created_at'
        )
        .all(projectId, type) as any[])
    : (db
        .prepare('SELECT * FROM entities WHERE project_id = ? ORDER BY type, sort_order, created_at')
        .all(projectId) as any[])
  return rows.map(rowToEntity)
}

export function getEntity(id: string): Entity | null {
  const db = getDB()
  const row = db.prepare('SELECT * FROM entities WHERE id = ?').get(id) as any
  return row ? rowToEntity(row) : null
}

export function upsertEntity(entity: Partial<Entity> & {
  projectId: string
  type: EntityType
}): Entity {
  const db = getDB()
  const now = Date.now()
  const existing = entity.id ? (db.prepare('SELECT * FROM entities WHERE id = ?').get(entity.id) as any) : null
  const id = entity.id ?? `e-${now}-${Math.random().toString(36).slice(2, 8)}`

  const maxOrder =
    (db
      .prepare('SELECT MAX(sort_order) as m FROM entities WHERE project_id = ? AND type = ?')
      .get(entity.projectId, entity.type) as any)?.m ?? 0

  const merged: Entity = {
    id,
    projectId: entity.projectId,
    type: entity.type,
    name: entity.name ?? existing?.name ?? '',
    summary: entity.summary ?? existing?.summary ?? '',
    data: entity.data ?? (existing ? safeParse(existing.data, {}) : {}),
    tags: entity.tags ?? (existing ? safeParse(existing.tags, []) : []),
    order: entity.order ?? existing?.sort_order ?? maxOrder + 1,
    createdAt: existing?.created_at ?? now,
    updatedAt: now
  }

  db.prepare(
    `
    INSERT INTO entities (id, project_id, type, name, summary, data, tags, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      summary = excluded.summary,
      data = excluded.data,
      tags = excluded.tags,
      sort_order = excluded.sort_order,
      updated_at = excluded.updated_at
  `
  ).run(
    merged.id,
    merged.projectId,
    merged.type,
    merged.name,
    merged.summary,
    JSON.stringify(merged.data),
    JSON.stringify(merged.tags),
    merged.order,
    merged.createdAt,
    merged.updatedAt
  )

  return merged
}

export function deleteEntity(id: string): void {
  const db = getDB()
  // 删除与该实体相关的关系
  db.prepare('DELETE FROM entity_relations WHERE from_id = ? OR to_id = ?').run(id, id)
  db.prepare('DELETE FROM entities WHERE id = ?').run(id)
}

function rowToEntity(row: any): Entity {
  return {
    id: row.id,
    projectId: row.project_id,
    type: row.type,
    name: row.name,
    summary: row.summary,
    data: safeParse(row.data, {}),
    tags: safeParse(row.tags, []),
    order: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

// ============================================================
// 关系 CRUD
// ============================================================

export function listRelations(
  projectId: string,
  opts?: { entityId?: string }
): EntityRelation[] {
  const db = getDB()
  const rows = opts?.entityId
    ? (db
        .prepare(
          'SELECT * FROM entity_relations WHERE project_id = ? AND (from_id = ? OR to_id = ?) ORDER BY created_at'
        )
        .all(projectId, opts.entityId, opts.entityId) as any[])
    : (db
        .prepare('SELECT * FROM entity_relations WHERE project_id = ? ORDER BY created_at')
        .all(projectId) as any[])
  return rows.map(rowToRelation)
}

export function upsertRelation(relation: Partial<EntityRelation> & {
  projectId: string
  fromId: string
  fromType: EntityType
  toId: string
  toType: EntityType
}): EntityRelation {
  const db = getDB()
  const now = Date.now()
  const existing = relation.id
    ? (db.prepare('SELECT * FROM entity_relations WHERE id = ?').get(relation.id) as any)
    : null
  const id = relation.id ?? `r-${now}-${Math.random().toString(36).slice(2, 8)}`

  const merged: EntityRelation = {
    id,
    projectId: relation.projectId,
    fromId: relation.fromId,
    fromType: relation.fromType,
    toId: relation.toId,
    toType: relation.toType,
    type: relation.type ?? existing?.type ?? '',
    note: relation.note ?? existing?.note ?? '',
    createdAt: existing?.created_at ?? now
  }

  db.prepare(
    `
    INSERT INTO entity_relations (id, project_id, from_id, from_type, to_id, to_type, type, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      from_id = excluded.from_id,
      from_type = excluded.from_type,
      to_id = excluded.to_id,
      to_type = excluded.to_type,
      type = excluded.type,
      note = excluded.note
  `
  ).run(
    merged.id,
    merged.projectId,
    merged.fromId,
    merged.fromType,
    merged.toId,
    merged.toType,
    merged.type,
    merged.note,
    merged.createdAt
  )

  return merged
}

export function deleteRelation(id: string): void {
  const db = getDB()
  db.prepare('DELETE FROM entity_relations WHERE id = ?').run(id)
}

export function deleteRelationsFrom(fromId: string, type?: string): void {
  const db = getDB()
  if (type !== undefined) {
    db.prepare('DELETE FROM entity_relations WHERE from_id = ? AND type = ?').run(fromId, type)
  } else {
    db.prepare('DELETE FROM entity_relations WHERE from_id = ?').run(fromId)
  }
}

function rowToRelation(row: any): EntityRelation {
  return {
    id: row.id,
    projectId: row.project_id,
    fromId: row.from_id,
    fromType: row.from_type,
    toId: row.to_id,
    toType: row.to_type,
    type: row.type,
    note: row.note,
    createdAt: row.created_at
  }
}

// ============================================================
// 工具
// ============================================================

function safeParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}
