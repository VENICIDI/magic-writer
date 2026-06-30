import { useEffect, useRef, useState } from 'react'
import { useProjectStore } from '../stores/project'
import { IconCelebrate, IconSparkles } from './Icons'

export function DailyGoal(): React.ReactElement {
  const dailyWordCount = useProjectStore((s) => s.dailyWordCount)
  const dailyGoal = useProjectStore((s) => s.dailyGoal)
  const setDailyGoal = useProjectStore((s) => s.setDailyGoal)
  const [showCelebration, setShowCelebration] = useState(false)
  const [hasTriggered, setHasTriggered] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(dailyGoal))
  const inputRef = useRef<HTMLInputElement>(null)

  const progress = dailyGoal > 0 ? Math.min(dailyWordCount / dailyGoal, 1) : 0
  const percentage = Math.round(progress * 100)

  // 达标时触发庆祝；进度回落到目标以下时重置，便于次日/重写后再次触发
  useEffect(() => {
    if (progress >= 1 && !hasTriggered) {
      setShowCelebration(true)
      setHasTriggered(true)
      setTimeout(() => setShowCelebration(false), 3000)
    } else if (progress < 1 && hasTriggered) {
      setHasTriggered(false)
    }
  }, [progress, hasTriggered])

  useEffect(() => {
    if (editing) {
      setDraft(String(dailyGoal))
      setTimeout(() => inputRef.current?.select(), 30)
    }
  }, [editing, dailyGoal])

  const commit = (): void => {
    const n = parseInt(draft, 10)
    if (!Number.isNaN(n) && n > 0) setDailyGoal(n)
    setEditing(false)
  }

  const barColor =
    progress >= 1 ? 'bg-green-500' : progress >= 0.6 ? 'bg-accent' : 'bg-gray-500'

  return (
    <>
      {/* 进度条（嵌入状态栏区域） */}
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-20 rounded-full bg-surface-600 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${barColor}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        {editing ? (
          <span className="text-sm text-gray-500">
            {dailyWordCount.toLocaleString()} /{' '}
            <input
              ref={inputRef}
              type="number"
              min={500}
              step={500}
              className="w-16 rounded bg-surface-700 px-1 text-sm text-gray-200 outline-none"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit()
                else if (e.key === 'Escape') setEditing(false)
              }}
            />
          </span>
        ) : (
          <button
            className="text-sm text-gray-500 hover:text-gray-300"
            onClick={() => setEditing(true)}
            title="点击调整每日目标"
          >
            {dailyWordCount.toLocaleString()} / {dailyGoal.toLocaleString()}
          </button>
        )}
      </div>

      {/* 庆祝动画 */}
      {showCelebration && (
        <div className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center">
          <div className="animate-bounce text-center">
            <div className="mb-2 flex justify-center text-accent-light"><IconCelebrate size={48} /></div>
            <div className="text-lg text-accent-light font-semibold">
              目标达成！今日已写 {dailyWordCount.toLocaleString()} 字
            </div>
          </div>
          {/* 简易 sparkle 效果 */}
          <div className="absolute inset-0 overflow-hidden">
            {Array.from({ length: 20 }).map((_, i) => (
              <span
                key={i}
                className="absolute animate-ping text-accent-light"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 1000}ms`,
                  animationDuration: `${1000 + Math.random() * 1000}ms`
                }}
              >
                <IconSparkles size={16} />
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
