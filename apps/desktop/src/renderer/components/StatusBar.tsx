import { useProjectStore } from '../stores/project'
import { DailyGoal } from './DailyGoal'

export function StatusBar(): React.ReactElement {
  const chapter = useProjectStore((s) => s.currentChapter)
  const words = useProjectStore((s) => s.wordCount)
  const saved = useProjectStore((s) => s.saved)
  const saveError = useProjectStore((s) => s.saveError)

  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-surface-600 bg-surface-800 px-4 text-xs text-gray-500">
      <span className="truncate">{chapter?.title ?? '无章节'}</span>
      <span className="h-3 w-px bg-surface-600" />
      <span>{words.toLocaleString()} 字</span>
      <span className="h-3 w-px bg-surface-600" />
      <DailyGoal />
      <div className="flex-1" />
      {saveError ? (
        <span className="text-red-500" title={saveError}>
          ⚠ 保存失败
        </span>
      ) : (
        <span className={saved ? 'text-green-500' : 'text-amber-400'}>
          {saved ? '● 已保存' : '○ 未保存'}
        </span>
      )}
    </footer>
  )
}
