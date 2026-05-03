/**
 * Magic Writer · SVG Icon Library
 *
 * 所有图标统一为 16×16 SVG，支持 className 自定义大小和颜色。
 */

interface IconProps {
  className?: string
  size?: number
}

function Icon({ className = '', size = 16, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  )
}

// ========== Agent 类型图标 ==========

/** 续写 - 羽毛笔 */
export function IconWriter({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </Icon>
  )
}

/** 润色 - 魔法棒/星光 */
export function IconPolish({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.287 1.288L3 12l5.8 1.9a2 2 0 0 1 1.288 1.287L12 21l1.9-5.8a2 2 0 0 1 1.287-1.288L21 12l-5.8-1.9a2 2 0 0 1-1.288-1.287Z" />
    </Icon>
  )
}

/** 审校 - 放大镜+勾 */
export function IconReview({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
      <path d="m8 11 2 2 4-4" />
    </Icon>
  )
}

/** 大纲 - 列表结构 */
export function IconOutline({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <path d="M16 12H3" />
      <path d="M16 6H3" />
      <path d="M16 18H3" />
      <path d="M21 6v12" />
      <path d="m18 9 3-3 3 3" />
      <path d="m18 15 3 3 3-3" />
    </Icon>
  )
}

// ========== 侧栏 Tab 图标 ==========

/** 章节 - 书本 */
export function IconBook({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
    </Icon>
  )
}

/** 世界观 - 地球 */
export function IconGlobe({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </Icon>
  )
}

/** 伏笔/目标 - 靶心 */
export function IconTarget({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </Icon>
  )
}

/** 关系图 - 网络节点 */
export function IconNetwork({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <circle cx="12" cy="5" r="3" />
      <circle cx="5" cy="19" r="3" />
      <circle cx="19" cy="19" r="3" />
      <path d="M12 8v4" />
      <path d="m4.9 17.5 5.1-4" />
      <path d="m14 13.5 5.1 4" />
    </Icon>
  )
}

// ========== 功能图标 ==========

/** 锁定 */
export function IconLock({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Icon>
  )
}

/** 解锁 */
export function IconUnlock({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </Icon>
  )
}

/** 设置齿轮 */
export function IconSettings({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  )
}

/** 加号 */
export function IconPlus({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </Icon>
  )
}

/** 庆祝/烟花 */
export function IconCelebrate({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <path d="m2 22 1-1h3l9-9" />
      <path d="M13 14 7.5 8.5" />
      <path d="m15 12 5-5" />
      <path d="m18 3 2.5 2.5" />
      <path d="M22 8h-3" />
      <path d="M19 5V2" />
      <path d="m10 4 1.5 1.5" />
      <path d="M5 10 3.5 8.5" />
      <path d="M4 6h2" />
      <path d="M6 4v2" />
    </Icon>
  )
}

/** 魔法棒 */
export function IconWand({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <path d="M15 4V2" />
      <path d="M15 16v-2" />
      <path d="M8 9h2" />
      <path d="M20 9h2" />
      <path d="M17.8 11.8 19 13" />
      <path d="M15 9h0" />
      <path d="M17.8 6.2 19 5" />
      <path d="m3 21 9-9" />
      <path d="M12.2 6.2 11 5" />
    </Icon>
  )
}

/** 灯泡/建议 */
export function IconLightbulb({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
      <path d="M9 18h6" />
      <path d="M10 22h4" />
    </Icon>
  )
}

/** 返回箭头 */
export function IconArrowLeft({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </Icon>
  )
}

/** 勾/完成 */
export function IconCheck({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <path d="M20 6 9 17l-5-5" />
    </Icon>
  )
}

/** 叉/关闭 */
export function IconX({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </Icon>
  )
}

/** 星光/sparkles */
export function IconSparkles({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.287 1.288L3 12l5.8 1.9a2 2 0 0 1 1.288 1.287L12 21l1.9-5.8a2 2 0 0 1 1.287-1.288L21 12l-5.8-1.9a2 2 0 0 1-1.288-1.287Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </Icon>
  )
}
