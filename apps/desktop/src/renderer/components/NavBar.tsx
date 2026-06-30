/**
 * NavBar — 全局左侧导航栏
 *
 * 模仿作家助手左侧导航：
 * - 顶部 Logo / 应用名
 * - 菜单项（作品列表、码字统计等）
 * - 底部设置
 */
import { IconBook, IconSettings } from './Icons'

export type NavPage = 'library' | 'workspace'

interface NavItem {
  id: NavPage
  label: string
  icon: React.ReactNode
}

interface NavBarProps {
  activePage: NavPage
  onNavigate: (page: NavPage) => void
  onOpenSettings: () => void
  projectTitle?: string
}

/** 写作图标 */
function IconPen({ size = 18 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  )
}

/** 统计图标 */
function IconBarChart({ size = 18 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20V10" />
      <path d="M18 20V4" />
      <path d="M6 20v-4" />
    </svg>
  )
}

export function NavBar({ activePage, onNavigate, onOpenSettings, projectTitle }: NavBarProps): React.ReactElement {
  const items: NavItem[] = [
    { id: 'library', label: '小说作品', icon: <IconBook size={16} /> },
  ]

  return (
    <div className="flex w-40 shrink-0 flex-col border-r border-surface-600 bg-surface-800">
      {/* ===== Logo 区域 ===== */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-surface-600">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-20 text-accent-light shadow-accent-glow">
          <IconPen size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-bold text-gray-200">Magic Writer</div>
        </div>
      </div>

      {/* ===== 主菜单 ===== */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {items.map((item) => (
          <button
            key={item.id}
            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
              activePage === item.id
                ? 'bg-accent-15 text-accent-light font-medium'
                : 'text-gray-400 hover:bg-surface-700 hover:text-gray-200'
            }`}
            onClick={() => onNavigate(item.id)}
          >
            {item.icon}
            {item.label}
          </button>
        ))}

        {/* 正在编辑的作品（快速入口） */}
        {projectTitle && (
          <>
            <div className="h-px bg-surface-600 my-2" />
            <button
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                activePage === 'workspace'
                  ? 'bg-accent-15 text-accent-light font-medium'
                  : 'text-gray-400 hover:bg-surface-700 hover:text-gray-200'
              }`}
              onClick={() => onNavigate('workspace')}
            >
              <IconPen size={16} />
              <span className="truncate">{projectTitle}</span>
            </button>
          </>
        )}

        <div className="h-px bg-surface-600 my-2" />

        {/* 更多菜单项（占位，后续可扩展） */}
        <button
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-gray-500 transition-colors hover:bg-surface-700 hover:text-gray-300"
          disabled
        >
          <IconBarChart size={16} />
          <span>码字统计</span>
          <span className="ml-auto text-[8px] text-gray-600">soon</span>
        </button>
      </nav>

      {/* ===== 底部设置 ===== */}
      <div className="border-t border-surface-600 px-2 py-2">
        <button
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-gray-400 transition-colors hover:bg-surface-700 hover:text-gray-200"
          onClick={onOpenSettings}
        >
          <IconSettings size={16} />
          设置
        </button>
      </div>
    </div>
  )
}
