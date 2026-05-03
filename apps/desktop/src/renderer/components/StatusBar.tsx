import { useProjectStore } from '../stores/project'
import { DailyGoal } from './DailyGoal'

function countWords(text: string): number {
  const zh = (text.match(/[\u4e00-\u9fff]/g) ?? []).length
  const en = (text.match(/[a-zA-Z]+/g) ?? []).length
  return zh + en
}

export function StatusBar(): React.ReactElement {
  const chapter = useProjectStore((s) => s.currentChapter)
  const content = useProjectStore((s) => s.currentContent)
  const saved = useProjectStore((s) => s.saved)

  const words = countWords(content)

  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-surface-600 bg-surface-800 px-4 text-xs text-gray-500">
      <span className="truncate">{chapter?.title ?? '无章节'}</span>
      <span className="h-3 w-px bg-surface-600" />
      <span>{words.toLocaleString()} 字</span>
      <span className="h-3 w-px bg-surface-600" />
      <DailyGoal />
      <div className="flex-1" />
      <span className={saved ? 'text-green-500' : 'text-amber-400'}>
        {saved ? '● 已保存' : '○ 未保存'}
      </span>
    </footer>
  )
}
