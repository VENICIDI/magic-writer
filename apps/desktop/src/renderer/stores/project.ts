import { create } from 'zustand'
import type { Chapter, Project, Volume } from '@magic-writer/shared'

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

interface ProjectState {
  // 数据
  projects: Project[]
  currentProject: Project | null
  volumes: Volume[]
  chapters: Chapter[]
  currentChapter: Chapter | null
  currentContent: string
  saved: boolean

  // UI
  sidebarVisible: boolean
  agentPanelVisible: boolean
  isWritingMode: boolean
  dailyGoal: number
  dailyWordCount: number

  // 动作
  bootstrap: () => Promise<void>
  openProject: (id: string) => Promise<void>
  openChapter: (id: string) => Promise<void>
  setContent: (content: string) => void
  saveCurrent: () => Promise<void>
  appendToChapter: (delta: string) => void

  toggleSidebar: () => void
  toggleAgentPanel: () => void
  toggleWritingMode: () => void
}

function countWords(text: string): number {
  const zh = (text.match(/[\u4e00-\u9fff]/g) ?? []).length
  const en = (text.match(/[a-zA-Z]+/g) ?? []).length
  return zh + en
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,
  volumes: [],
  chapters: [],
  currentChapter: null,
  currentContent: '',
  saved: true,

  sidebarVisible: true,
  agentPanelVisible: true,
  isWritingMode: false,
  dailyGoal: 5000,
  dailyWordCount: 0,

  bootstrap: async () => {
    const { projects } = await window.api.project.list()
    set({ projects })
    const first = projects[0]
    if (first) {
      await get().openProject(first.id)
    }
  },

  openProject: async (id) => {
    const project = await window.api.project.get(id)
    if (!project) return
    const { volumes, chapters } = await window.api.chapter.list(id)
    set({ currentProject: project, volumes, chapters })
    const first = chapters[0]
    if (first) await get().openChapter(first.id)
  },

  openChapter: async (id) => {
    // 保存当前章节再切换
    if (!get().saved) {
      await get().saveCurrent()
    }
    const res = await window.api.chapter.get(id)
    if (!res) return
    set({ currentChapter: res.chapter, currentContent: res.content, saved: true })
  },

  setContent: (content) => {
    const prevWords = countWords(get().currentContent)
    const newWords = countWords(content)
    const delta = Math.max(0, newWords - prevWords)

    set((s) => ({
      currentContent: content,
      saved: false,
      dailyWordCount: s.dailyWordCount + delta
    }))

    // 自动保存（2 秒无输入后触发）
    if (autoSaveTimer) clearTimeout(autoSaveTimer)
    autoSaveTimer = setTimeout(() => {
      get().saveCurrent()
    }, 2000)
  },

  appendToChapter: (delta) => {
    set((s) => ({
      currentContent: s.currentContent + delta,
      saved: false,
      dailyWordCount: s.dailyWordCount + countWords(delta)
    }))
  },

  saveCurrent: async () => {
    const { currentChapter, currentContent } = get()
    if (!currentChapter) return
    const updated = await window.api.chapter.save({
      chapterId: currentChapter.id,
      content: currentContent
    })
    if (updated) {
      set((s) => ({
        currentChapter: updated,
        saved: true,
        chapters: s.chapters.map((c) => (c.id === updated.id ? updated : c))
      }))
    }
  },

  toggleSidebar: () => set((s) => ({ sidebarVisible: !s.sidebarVisible })),
  toggleAgentPanel: () => set((s) => ({ agentPanelVisible: !s.agentPanelVisible })),
  toggleWritingMode: () => set((s) => ({ isWritingMode: !s.isWritingMode }))
}))
