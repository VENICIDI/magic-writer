import { app, BrowserWindow, ipcMain } from 'electron'
import {
  IPC,
  type AgentRunRequest,
  type ChapterSaveRequest,
  type Entity,
  type EntityListRequest,
  type EntityDeleteRequest,
  type EntityGenerateRequest,
  type EntityRelation,
  type LLMStreamChunk,
  type ProjectCreateRequest,
  type RelationDeleteRequest,
  type RelationListRequest
} from '@magic-writer/shared'
import {
  createChapter,
  createProject,
  createVolume,
  deleteChapter,
  deleteProject,
  deleteVolume,
  renameChapter,
  renameVolume,
  getChapterContent,
  getProject,
  listChapters,
  listProjects,
  saveChapter,
  listChapterBackups,
  readChapterBackup,
  searchChapters,
  listCharacters,
  upsertCharacter,
  deleteCharacter,
  listForeshadowing,
  upsertForeshadowing,
  listEntities,
  getEntity,
  upsertEntity,
  deleteEntity,
  listRelations,
  upsertRelation,
  deleteRelation,
  getSetting,
  setSetting,
  saveMapImage,
  readMapImage,
  deleteMapImage
} from '../storage'
import { runAgent } from '../agents'
import { generateEntity } from '../agents/entity-generator'
import { getWorldviewUrl } from '../worldview/service'

export function registerIpcHandlers(): void {
  // ---------- 系统 ----------
  ipcMain.handle(IPC.AppVersion, () => app.getVersion())

  // ---------- 项目 ----------
  ipcMain.handle(IPC.ProjectList, () => {
    return { projects: listProjects() }
  })
  ipcMain.handle(IPC.ProjectGet, (_e, id: string) => {
    return getProject(id)
  })
  ipcMain.handle(IPC.ProjectCreate, (_e, req: ProjectCreateRequest) => {
    return createProject(req)
  })
  ipcMain.handle('project:delete', (_e, id: string) => {
    deleteProject(id)
    return { ok: true }
  })

  // ---------- 卷 ----------
  ipcMain.handle('volume:create', (_e, req: { projectId: string; title: string }) => {
    return createVolume(req.projectId, req.title)
  })
  ipcMain.handle('volume:delete', (_e, id: string) => {
    deleteVolume(id)
    return { ok: true }
  })
  ipcMain.handle('volume:rename', (_e, req: { id: string; title: string }) => {
    return renameVolume(req.id, req.title)
  })

  // ---------- 章节 ----------
  ipcMain.handle(IPC.ChapterList, (_e, projectId: string) => {
    return listChapters(projectId)
  })
  ipcMain.handle(IPC.ChapterGet, (_e, chapterId: string) => {
    return getChapterContent(chapterId)
  })
  ipcMain.handle(IPC.ChapterSave, (_e, req: ChapterSaveRequest) => {
    return saveChapter(req.chapterId, req.content)
  })
  ipcMain.handle(
    IPC.ChapterCreate,
    (
      _e,
      req: { projectId: string; volumeId: string; title: string }
    ) => {
      return createChapter(req)
    }
  )
  ipcMain.handle('chapter:delete', (_e, id: string) => {
    deleteChapter(id)
    return { ok: true }
  })
  ipcMain.handle('chapter:rename', (_e, req: { id: string; title: string }) => {
    return renameChapter(req.id, req.title)
  })

  // ---------- 全文搜索 ----------
  ipcMain.handle('chapter:search', (_e, req: { projectId: string; query: string }) => {
    return searchChapters(req.projectId, req.query)
  })

  // ---------- 世界观 ----------
  ipcMain.handle('world:character:list', (_e, projectId: string) => {
    return listCharacters(projectId)
  })
  ipcMain.handle('world:character:upsert', (_e, character: any) => {
    return upsertCharacter(character)
  })
  ipcMain.handle('world:character:delete', (_e, id: string) => {
    deleteCharacter(id)
    return { ok: true }
  })
  ipcMain.handle('world:foreshadowing:list', (_e, projectId: string) => {
    return listForeshadowing(projectId)
  })
  ipcMain.handle('world:foreshadowing:upsert', (_e, item: any) => {
    return upsertForeshadowing(item)
  })

  // ---------- 统一实体 ----------
  ipcMain.handle(IPC.EntityList, (_e, req: EntityListRequest) => {
    return listEntities(req.projectId, req.type)
  })
  ipcMain.handle(IPC.EntityGet, (_e, id: string) => {
    return getEntity(id)
  })
  ipcMain.handle(IPC.EntityUpsert, (_e, entity: Partial<Entity> & { projectId: string; type: Entity['type'] }) => {
    return upsertEntity(entity)
  })
  ipcMain.handle(IPC.EntityDelete, (_e, req: EntityDeleteRequest) => {
    deleteEntity(req.id)
    return { ok: true }
  })
  ipcMain.handle(IPC.EntityGenerate, async (_e, req: EntityGenerateRequest) => {
    try {
      const entity = await generateEntity(req.projectId, req.type, req.hint)
      return { ok: true, entity }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { ok: false, error: message }
    }
  })

  // ---------- 统一关系 ----------
  ipcMain.handle(IPC.RelationList, (_e, req: RelationListRequest) => {
    return listRelations(req.projectId, { entityId: req.entityId })
  })
  ipcMain.handle(
    IPC.RelationUpsert,
    (
      _e,
      relation: Partial<EntityRelation> & {
        projectId: string
        fromId: string
        fromType: EntityRelation['fromType']
        toId: string
        toType: EntityRelation['toType']
      }
    ) => {
      return upsertRelation(relation)
    }
  )
  ipcMain.handle(IPC.RelationDelete, (_e, req: RelationDeleteRequest) => {
    deleteRelation(req.id)
    return { ok: true }
  })

  // ---------- 设置 ----------
  ipcMain.handle('settings:get', (_e, req: { key: string; defaultValue: any }) => {
    return getSetting(req.key, req.defaultValue)
  })
  ipcMain.handle('settings:set', (_e, req: { key: string; value: any }) => {
    setSetting(req.key, req.value)
    return { ok: true }
  })

  // ---------- 世界观分析 ----------
  ipcMain.handle('worldview:getUrl', () => {
    return getWorldviewUrl()
  })

  // ---------- 地图底图（图片落盘 / 读取 / 删除） ----------
  ipcMain.handle(
    'map:saveImage',
    (_e, req: { projectId: string; dataBase64: string; ext: string }) => {
      return saveMapImage(req.projectId, req.dataBase64, req.ext)
    }
  )
  ipcMain.handle('map:readImage', (_e, fileName: string) => {
    return { dataUrl: readMapImage(fileName) }
  })
  ipcMain.handle('map:deleteImage', (_e, fileName: string) => {
    deleteMapImage(fileName)
    return { ok: true }
  })

  // ---------- Agent（流式） ----------
  // 每个进行中的请求维护一个 AbortController，供 AgentStop 中断。
  const runningAborts = new Map<string, AbortController>()

  ipcMain.handle(IPC.AgentRun, async (event, req: AgentRunRequest) => {
    const senderWin = BrowserWindow.fromWebContents(event.sender)
    const send = (chunk: LLMStreamChunk): void => {
      if (senderWin && !senderWin.isDestroyed()) {
        senderWin.webContents.send(IPC.AgentStreamChunk, chunk)
      }
    }
    const controller = new AbortController()
    runningAborts.set(req.requestId, controller)
    try {
      for await (const ev of runAgent(req, controller.signal)) {
        send({ requestId: req.requestId, delta: ev.delta, done: ev.done })
        if (ev.done) break
      }
      return { requestId: req.requestId, ok: true }
    } catch (err) {
      // 用户主动中断：作为正常结束，不抛中文错误
      if (controller.signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
        send({ requestId: req.requestId, delta: '', done: true })
        return { requestId: req.requestId, ok: true }
      }
      const message = err instanceof Error ? err.message : String(err)
      send({ requestId: req.requestId, delta: '', done: true, error: message })
      return { requestId: req.requestId, ok: false, error: message }
    } finally {
      runningAborts.delete(req.requestId)
    }
  })

  ipcMain.handle(IPC.AgentStop, (_e, requestId: string) => {
    const controller = runningAborts.get(requestId)
    if (controller) {
      controller.abort()
      runningAborts.delete(requestId)
      return { ok: true }
    }
    return { ok: false }
  })

  // ---------- 章节版本快照 ----------
  ipcMain.handle('chapter:backups:list', (_e, chapterId: string) => {
    return listChapterBackups(chapterId)
  })
  ipcMain.handle('chapter:backups:read', (_e, req: { chapterId: string; file: string }) => {
    return { content: readChapterBackup(req.chapterId, req.file) }
  })
}
