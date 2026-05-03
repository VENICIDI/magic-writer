import { useEffect, useState } from 'react'
import { useProjectStore } from '../stores/project'
import { IconCelebrate, IconSparkles } from './Icons'

export function DailyGoal(): React.ReactElement {
  const dailyWordCount = useProjectStore((s) => s.dailyWordCount)
  const dailyGoal = useProjectStore((s) => s.dailyGoal)
  const [showCelebration, setShowCelebration] = useState(false)
  const [hasTriggered, setHasTriggered] = useState(false)

  const progress = Math.min(dailyWordCount / dailyGoal, 1)
  const percentage = Math.round(progress * 100)

  // 触发庆祝动画
  useEffect(() => {
    if (progress >= 1 && !hasTriggered) {
      setShowCelebration(true)
      setHasTriggered(true)
      setTimeout(() => setShowCelebration(false), 3000)
    }
  }, [progress, hasTriggered])

  // 进度条颜色渐变
  const barColor =
    progress >= 1
      ? 'bg-green-500'
      : progress >= 0.6
        ? 'bg-accent'
        : 'bg-gray-500'

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
        <span className="text-[12px] text-gray-500">
          {dailyWordCount.toLocaleString()} / {dailyGoal.toLocaleString()}
        </span>
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
