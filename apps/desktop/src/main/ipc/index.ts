import { app, BrowserWindow, ipcMain } from 'electron'
import {
  IPC,
  type AgentRunRequest,
  type ChapterSaveRequest,
  type LLMStreamChunk,
  type ProjectCreateRequest
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
  searchChapters,
  listCharacters,
  upsertCharacter,
  deleteCharacter,
  listForeshadowing,
  upsertForeshadowing,
  getSetting,
  setSetting
} from '../storage'
import { runAgent } from '../agents'
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

  // ---------- Agent（流式） ----------
  ipcMain.handle(IPC.AgentRun, async (event, req: AgentRunRequest) => {
    const senderWin = BrowserWindow.fromWebContents(event.sender)
    const send = (chunk: LLMStreamChunk): void => {
      if (senderWin && !senderWin.isDestroyed()) {
        senderWin.webContents.send(IPC.AgentStreamChunk, chunk)
      }
    }
    try {
      for await (const ev of runAgent(req)) {
        send({ requestId: req.requestId, delta: ev.delta, done: ev.done })
        if (ev.done) break
      }
      return { requestId: req.requestId, ok: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      send({ requestId: req.requestId, delta: '', done: true, error: message })
      return { requestId: req.requestId, ok: false, error: message }
    }
  })
}
