import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  IPC,
  type AgentRunRequest,
  type AgentRunResponse,
  type Chapter,
  type Character,
  type ChapterSaveRequest,
  type LLMStreamChunk,
  type Project,
  type ProjectCreateRequest,
  type ProjectListResponse,
  type Volume
} from '@magic-writer/shared'

// ---------- 暴露给 renderer 的 API ----------

const api = {
  app: {
    version: (): Promise<string> => ipcRenderer.invoke(IPC.AppVersion)
  },
  project: {
    list: (): Promise<ProjectListResponse> => ipcRenderer.invoke(IPC.ProjectList),
    get: (id: string): Promise<Project | null> => ipcRenderer.invoke(IPC.ProjectGet, id),
    create: (req: ProjectCreateRequest): Promise<Project> =>
      ipcRenderer.invoke(IPC.ProjectCreate, req),
    delete: (id: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('project:delete', id)
  },
  volume: {
    create: (req: { projectId: string; title: string }): Promise<Volume> =>
      ipcRenderer.invoke('volume:create', req),
    delete: (id: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('volume:delete', id)
  },
  chapter: {
    list: (projectId: string): Promise<{ volumes: Volume[]; chapters: Chapter[] }> =>
      ipcRenderer.invoke(IPC.ChapterList, projectId),
    get: (
      chapterId: string
    ): Promise<{ chapter: Chapter; content: string } | null> =>
      ipcRenderer.invoke(IPC.ChapterGet, chapterId),
    save: (req: ChapterSaveRequest): Promise<Chapter | null> =>
      ipcRenderer.invoke(IPC.ChapterSave, req),
    create: (req: {
      projectId: string
      volumeId: string
      title: string
    }): Promise<Chapter> => ipcRenderer.invoke(IPC.ChapterCreate, req),
    delete: (id: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('chapter:delete', id),
    search: (req: { projectId: string; query: string }): Promise<Array<{ chapterId: string; snippet: string }>> =>
      ipcRenderer.invoke('chapter:search', req)
  },
  agent: {
    run: (req: AgentRunRequest): Promise<AgentRunResponse> =>
      ipcRenderer.invoke(IPC.AgentRun, req),
    onStreamChunk: (handler: (chunk: LLMStreamChunk) => void): (() => void) => {
      const listener = (_e: unknown, chunk: LLMStreamChunk): void => handler(chunk)
      ipcRenderer.on(IPC.AgentStreamChunk, listener)
      return () => ipcRenderer.removeListener(IPC.AgentStreamChunk, listener)
    }
  },
  world: {
    listCharacters: (projectId: string): Promise<Character[]> =>
      ipcRenderer.invoke('world:character:list', projectId),
    upsertCharacter: (character: Character): Promise<Character> =>
      ipcRenderer.invoke('world:character:upsert', character),
    deleteCharacter: (id: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('world:character:delete', id)
  },
  settings: {
    get: <T>(key: string, defaultValue: T): Promise<T> =>
      ipcRenderer.invoke('settings:get', { key, defaultValue }),
    set: <T>(key: string, value: T): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('settings:set', { key, value })
  }
}

export type MagicWriterAPI = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore fallback for non-isolated context
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
