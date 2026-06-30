/**
 * Magic Writer · SQLite 数据库初始化与迁移
 */
import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { mkdirSync } from 'fs'

let db: Database.Database | null = null

export function getDataDir(): string {
  const dir = join(app.getPath('userData'), 'magic-writer-data')
  mkdirSync(dir, { recursive: true })
  mkdirSync(join(dir, 'chapters'), { recursive: true })
  return dir
}

export function getDB(): Database.Database {
  if (db) return db

  const dir = getDataDir()
  const dbPath = join(dir, 'meta.db')

  db = new Database(dbPath)

  // 启用 WAL 模式（并发读 + 写入快）
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')
  db.pragma('foreign_keys = ON')

  // 执行迁移
  migrate(db)

  return db
}

function migrate(db: Database.Database): void {
  // 获取当前 schema 版本
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (version INTEGER PRIMARY KEY)`)
  const row = db.prepare('SELECT MAX(version) as v FROM _migrations').get() as
    | { v: number | null }
    | undefined
  const currentVersion = row?.v ?? 0

  const migrations: Array<{ version: number; sql: string }> = [
    {
      version: 1,
      sql: `
        -- 项目
        CREATE TABLE IF NOT EXISTS projects (
          id          TEXT PRIMARY KEY,
          title       TEXT NOT NULL,
          genre       TEXT NOT NULL DEFAULT '',
          logline     TEXT NOT NULL DEFAULT '',
          root_path   TEXT NOT NULL DEFAULT '',
          created_at  INTEGER NOT NULL,
          updated_at  INTEGER NOT NULL
        );

        -- 卷
        CREATE TABLE IF NOT EXISTS volumes (
          id          TEXT PRIMARY KEY,
          project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          title       TEXT NOT NULL,
          sort_order  INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_volumes_project ON volumes(project_id);

        -- 章节
        CREATE TABLE IF NOT EXISTS chapters (
          id          TEXT PRIMARY KEY,
          project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          volume_id   TEXT NOT NULL REFERENCES volumes(id) ON DELETE CASCADE,
          title       TEXT NOT NULL,
          file_path   TEXT NOT NULL,
          outline     TEXT NOT NULL DEFAULT '',
          word_count  INTEGER NOT NULL DEFAULT 0,
          status      TEXT NOT NULL DEFAULT 'draft',
          sort_order  INTEGER NOT NULL DEFAULT 0,
          updated_at  INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_chapters_project ON chapters(project_id);
        CREATE INDEX IF NOT EXISTS idx_chapters_volume ON chapters(volume_id);

        -- 人物卡
        CREATE TABLE IF NOT EXISTS characters (
          id                      TEXT PRIMARY KEY,
          project_id              TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          name                    TEXT NOT NULL,
          aliases                 TEXT NOT NULL DEFAULT '[]',
          age                     INTEGER,
          appearance              TEXT NOT NULL DEFAULT '',
          personality             TEXT NOT NULL DEFAULT '',
          abilities               TEXT NOT NULL DEFAULT '[]',
          relations               TEXT NOT NULL DEFAULT '[]',
          first_appear_chapter_id TEXT,
          locked_fields           TEXT NOT NULL DEFAULT '[]'
        );
        CREATE INDEX IF NOT EXISTS idx_characters_project ON characters(project_id);

        -- 伏笔
        CREATE TABLE IF NOT EXISTS foreshadowing (
          id          TEXT PRIMARY KEY,
          project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          description TEXT NOT NULL,
          planted_at  TEXT NOT NULL DEFAULT '{}',
          resolved_at TEXT,
          status      TEXT NOT NULL DEFAULT 'pending'
        );
        CREATE INDEX IF NOT EXISTS idx_foreshadowing_project ON foreshadowing(project_id);

        -- Agent 会话
        CREATE TABLE IF NOT EXISTS agent_sessions (
          id          TEXT PRIMARY KEY,
          project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          type        TEXT NOT NULL,
          messages    TEXT NOT NULL DEFAULT '[]',
          created_at  INTEGER NOT NULL,
          updated_at  INTEGER NOT NULL
        );

        -- 用户设置 KV
        CREATE TABLE IF NOT EXISTS settings (
          key   TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `
    },
    {
      version: 2,
      sql: `
        -- 全文搜索虚拟表
        CREATE VIRTUAL TABLE IF NOT EXISTS chapters_fts USING fts5(
          chapter_id,
          content,
          tokenize='unicode61'
        );
      `
    },
    {
      version: 3,
      sql: `
        -- 统一多态实体表（人物/事件/地点/道具/伏笔等）
        CREATE TABLE IF NOT EXISTS entities (
          id          TEXT PRIMARY KEY,
          project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          type        TEXT NOT NULL,
          name        TEXT NOT NULL DEFAULT '',
          summary     TEXT NOT NULL DEFAULT '',
          data        TEXT NOT NULL DEFAULT '{}',
          tags        TEXT NOT NULL DEFAULT '[]',
          sort_order  INTEGER NOT NULL DEFAULT 0,
          created_at  INTEGER NOT NULL,
          updated_at  INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_entities_project_type ON entities(project_id, type);

        -- 统一关系表（连接任意实体，也可引用章节）
        CREATE TABLE IF NOT EXISTS entity_relations (
          id          TEXT PRIMARY KEY,
          project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          from_id     TEXT NOT NULL,
          from_type   TEXT NOT NULL,
          to_id       TEXT NOT NULL,
          to_type     TEXT NOT NULL,
          type        TEXT NOT NULL DEFAULT '',
          note        TEXT NOT NULL DEFAULT '',
          created_at  INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_relations_project ON entity_relations(project_id);
        CREATE INDEX IF NOT EXISTS idx_relations_from ON entity_relations(from_id);
        CREATE INDEX IF NOT EXISTS idx_relations_to ON entity_relations(to_id);
      `
    }
  ]

  const insert = db.prepare('INSERT INTO _migrations (version) VALUES (?)')

  for (const m of migrations) {
    if (m.version > currentVersion) {
      db.exec(m.sql)
      insert.run(m.version)
    }
  }
}

export function closeDB(): void {
  if (db) {
    db.close()
    db = null
  }
}
