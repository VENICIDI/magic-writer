import { create } from 'zustand'
import { countWords, type Chapter, type Project, type Volume } from '@magic-writer/shared'

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
let statsTimer: ReturnType<typeof setTimeout> | null = null

// 字数统计基线：用于把「净增量」累加进今日字数
// 撤销/重做改由 Monaco 原生历史接管，这里不再维护自建历史栈。
let lastCountedWords = 0

function resetStatsBaseline(content: string): void {
  lastCountedWords = countWords(content)
}

function todayStr(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

interface ProjectState {
  // 数据
  projects: Project[]
  currentProject: Project | null
  volumes: Volume[]
  chapters: Chapter[]
  currentChapter: Chapter | null
  currentContent: string
  wordCount: number
  saved: boolean
  saveError: string | null

  // UI
  sidebarVisible: boolean
  agentPanelVisible: boolean
  isWritingMode: boolean
  dailyGoal: number
  dailyWordCount: number
  dailyDate: string

  // 动作
  bootstrap: () => Promise<void>
  openProject: (id: string) => Promise<void>
  openChapter: (id: string) => Promise<void>
  setContent: (content: string) => void
  saveCurrent: () => Promise<void>

  // 每日目标
  setDailyGoal: (goal: number) => void

  toggleSidebar: () => void
  toggleAgentPanel: () => void
  toggleWritingMode: () => void
}

export const useProjectStore = create<ProjectState>((set, get) => {
  /** 去抖重算字数与今日进度，避免每次按键全量重算 */
  function scheduleStats(): void {
    if (statsTimer) clearTimeout(statsTimer)
    statsTimer = setTimeout(() => recomputeStats(), 400)
  }

  function recomputeStats(): void {
    const words = countWords(get().currentContent)
    const delta = words - lastCountedWords
    lastCountedWords = words
    const today = todayStr()
    set((s) => {
      const base = s.dailyDate === today ? s.dailyWordCount : 0
      const dailyWordCount = Math.max(0, base + delta)
      void window.api.settings.set('daily.count', dailyWordCount)
      void window.api.settings.set('daily.date', today)
      return { wordCount: words, dailyWordCount, dailyDate: today }
    })
  }

  function scheduleAutosave(): void {
    if (autoSaveTimer) clearTimeout(autoSaveTimer)
    autoSaveTimer = setTimeout(() => {
      void get().saveCurrent()
    }, 2000)
  }

  return {
    projects: [],
    currentProject: null,
    volumes: [],
    chapters: [],
    currentChapter: null,
    currentContent: '',
    wordCount: 0,
    saved: true,
    saveError: null,

    sidebarVisible: true,
    agentPanelVisible: true,
    isWritingMode: false,
    dailyGoal: 5000,
    dailyWordCount: 0,
    dailyDate: todayStr(),

    bootstrap: async () => {
      const { projects } = await window.api.project.list()
      set({ projects })

      // 加载每日目标与今日进度（跨天自动归零、重启保留当天进度）
      const dailyGoal = await window.api.settings.get('daily.goal', 5000)
      const savedDate = await window.api.settings.get('daily.date', '')
      const savedCount = await window.api.settings.get('daily.count', 0)
      const today = todayStr()
      if (savedDate === today) {
        set({ dailyGoal, dailyDate: today, dailyWordCount: savedCount })
      } else {
        set({ dailyGoal, dailyDate: today, dailyWordCount: 0 })
        void window.api.settings.set('daily.date', today)
        void window.api.settings.set('daily.count', 0)
      }

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
      resetStatsBaseline(res.content)
      set({
        currentChapter: res.chapter,
        currentContent: res.content,
        wordCount: countWords(res.content),
        saved: true,
        saveError: null
      })
    },

    setContent: (content) => {
      // Monaco 是非受控的内容源，这里只同步状态并去抖触发字数统计/自动保存
      set({ currentContent: content, saved: false })
      scheduleStats()
      scheduleAutosave()
    },

    saveCurrent: async () => {
      const { currentChapter, currentContent } = get()
      if (!currentChapter) return
      try {
        const updated = await window.api.chapter.save({
          chapterId: currentChapter.id,
          content: currentContent
        })
        if (updated) {
          set((s) => ({
            currentChapter: updated,
            saved: true,
            saveError: null,
            chapters: s.chapters.map((c) => (c.id === updated.id ? updated : c))
          }))
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        set({ saved: false, saveError: message })
      }
    },

    setDailyGoal: (goal) => {
      const g = Math.max(0, Math.floor(goal) || 0)
      set({ dailyGoal: g })
      void window.api.settings.set('daily.goal', g)
    },

    toggleSidebar: () => set((s) => ({ sidebarVisible: !s.sidebarVisible })),
    toggleAgentPanel: () => set((s) => ({ agentPanelVisible: !s.agentPanelVisible })),
    toggleWritingMode: () => set((s) => ({ isWritingMode: !s.isWritingMode }))
  }
})
