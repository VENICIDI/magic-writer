---
name: voltagent-design
description: VoltAgent 风格设计系统（碳黑底 + 翡翠信号绿 #00d992 的开发者终端美学）。当需要为 Magic Writer 生成或调整 UI、选择颜色/字体/间距/圆角/阴影、设计组件（按钮、卡片、输入框、导航、对话气泡）或重构界面视觉时使用。也适用于用户提到 VoltAgent、设计规范、配色、design system、深色主题、绿色强调色等场景。
---

# VoltAgent 设计系统

为 Magic Writer 生成符合 VoltAgent 视觉语言的 UI：碳黑画布 + 单一翡翠绿强调色 + 暖灰中性色的「深夜 IDE」开发者终端美学。完整 token 与组件细则见 [DESIGN.md](DESIGN.md)；可视化预览见 `preview.html`（浅）/ `preview-dark.html`（深）。

## 核心色板（速查）

| 角色 | 名称 | 色值 |
|---|---|---|
| 页面背景 | Abyss Black | `#050507` |
| 卡片/输入背景 | Carbon Surface | `#101010` |
| 边框/容器线 | Warm Charcoal | `#3d3a39` |
| 品牌强调 | Emerald Signal Green | `#00d992` |
| 按钮文字绿 | VoltAgent Mint | `#2fd6a1` |
| 主文字 | Snow White | `#f2f2f2` |
| 次要文字 | Warm Parchment | `#b8b3b0` |
| 三级文字 | Steel Slate | `#8b949e` |

语义色：success `#008b00` / warning `#ffba00` / danger `#fb565b` / info `#4cb3d4`。

## 关键原则

- **双层深色**：页面用 Abyss Black，所有容器用 Carbon Surface（仅差一档），靠 Warm Charcoal 边框界定区块。
- **绿是信号不是表面**：`#00d992` 只用于高信号点（激活边框、发光、最重要的交互），绝不做大面积填充背景。亮绿背景上的文字用深色（如 `#050507`），不要用白色。
- **用边框/边框色传达层级**：`1px #3d3a39` → `2px #00d992`（强调）→ `3px #3d3a39`（加重），优先于阴影。阴影仅在 L4/L5 使用。
- **暖中性防止冰冷**：边框与次要文字用暖灰（`#3d3a39 / #b8b3b0 / #8b949e`），不要纯冷蓝灰。
- **排版**：标题用 `system-ui`（紧行高 1.0–1.11、负字距），正文/UI 用 `Inter`，代码用 `SFMono-Regular`。大写文字必配宽字距（0.45–2.52px）。
- **克制动效**：缓慢、轻微（marquee 25–80s，glow 脉冲）；快速跳跃动效违背工程精确感。
- **不要做的事**：不用亮色主表面；不用橙/黄/红做装饰（仅语义状态）；内容卡圆角不超过 8px（pill 9999px 仅用于小标签）；正文不用纯白（用 `#f2f2f2`）。

## 在 Magic Writer 中落地

项目颜色集中在 `apps/desktop/src/renderer/App.css` 的 `@theme` 变量：
`--color-surface-900/800/700/600/500`、`--color-accent`、`--color-accent-light`、`--th-text-primary`。组件统一用 `bg-surface-*`、`text-accent-light`、`bg-accent`、`bg-accent-15/20` 等工具类驱动，**改变量即可全局换肤**。新增 UI 时复用这些 token，避免硬编码 hex。

## 生成 UI 的提示词范例

> 「在 Carbon Surface (#101010) 上做一张卡片，1px Warm Charcoal (#3d3a39) 边框，圆角 8px。标题用 system-ui 24px/700 Snow White (#f2f2f2)，描述用 Inter 16px Warm Parchment (#b8b3b0)。加 Warm Ambient 阴影 rgba(92,88,85,0.2) 0 0 15px。」

更多组件提示词与完整 token（字号表、阴影分级、响应式断点）见 [DESIGN.md](DESIGN.md) 第 4、9 节。
