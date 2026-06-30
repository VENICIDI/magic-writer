# Magic Writer · 写作体验问题梳理

> 更新日期：2026-06-30
> 范围：写作链路（编辑器、AI 面板、保存、状态栏、每日目标）

结论先行：最伤体验的是「编辑器是个原生 textarea + AI 永远往文末追加」这两点，其它问题大多是在此之上的连锁反应。

---

## 一、致命级（直接劝退写作）

### 1. 编辑器名不副实：用的是原生 `<textarea>`，不是 Monaco
README 与架构文档都宣称使用 Monaco 编辑器，但 `apps/desktop/src/renderer/components/Editor.tsx` 实际是受控 `<textarea>`。连锁后果：

- **撤销/重做基本废了**：`value={content}` 受控 + 每次 `setContent` 重设 value，会打断浏览器原生 undo 栈，`⌘Z` 经常跳到很早的状态或失效。对网文是硬伤。
- 无查找替换（`⌘F` 还被写作模式占用）、无行号、无段落大纲、无大文档虚拟化。
- **长章节卡顿**：每次输入都全量 `setState` + 重渲染整段正文，几万字时输入有明显延迟。

### 2. AI 写入永远追加到文末，不认光标、不认选区
`apps/desktop/src/renderer/stores/project.ts` 的 `appendToChapter` 是 `currentContent + delta`，于是：

- 右键选中一段点「润色 / 改写对话 / 去口水话」（`Editor.tsx`），结果**不会替换选中文字**，而是把润色稿堆到全章末尾，需手动剪切粘贴。
- 续写也只能从结尾接，无法「在光标处插入」。
- 流式写入时编辑器**不自动滚动**到生成位置，用户看不见 AI 正在写什么。

这两条让「AI 辅助写作」这个核心卖点在实操里很难用。

---

## 二、严重级（数据安全 / 关键交互缺失）

### 3. 保存无失败反馈，易丢稿
`saveCurrent`（`project.ts`）的 IPC 若报错没有任何提示，状态栏照样显示「已保存」，用户无感知地丢字。配合不可靠的 undo，误操作几乎不可恢复（也没有章节版本历史）。

### 4. 「停止生成」形同虚设
- AgentPanel 没有停止按钮；store 里的 `stop()`（`agent.ts`）只是前端把气泡标记为 done，**后端 LLM 请求并没被真正中断**（IPC 没有 `AgentStop` 通道，架构文档里规划了但未实现），token 继续烧。

### 5. 生成时整个输入被锁死
AgentPanel 输入框 `disabled={running}`，生成期间不能预输入下一条指令；正文虽可编辑，但 AI 又在往文末追加，容易互相打架。

### 6. Agent 意图错乱
- `activeAgent` 恒为 `'writer'`，UI 没有切换续写/润色/审校/大纲的入口。
- 右键「润色」时，agent store `send`（`agent.ts`）发出去的 `agentType` 仍是 `'writer'`，真正意图全靠后端 Router 猜。
- 流式匹配靠「最后一条 turn 的 id === requestId」，**生成中再触发一次右键润色**，turns 顺序和 requestId 会错位，内容可能写进错误气泡。

---

## 三、中等级（统计 / 反馈不准）

### 7. 今日字数统计失真，且不会重置
`setContent`（`project.ts`）用 `Math.max(0, newWords - prevWords)`：删字不减、AI 一次性灌入/粘贴会瞬间暴涨；`dailyWordCount` 只增不减，**重启清零、跨天不归零**，每日目标不可在 UI 调整也不持久化，庆祝动画（`DailyGoal.tsx`）触发一次后本会话不再触发。

### 8. `countWords` 三处各写一份
store、`StatusBar.tsx`、storage 各实现一份，口径容易不一致。

### 9. 错误信息直接抛英文
如 `LLM HTTP 401: ...` 原样显示给用户，违背「中文优先」语境，也不告诉用户怎么修（去设置填 Key）。

---

## 四、细节 / 打磨级

- **标题输入用尾随空格 hack**（`chapter.title + ' '` + onBlur 手动补空格 + 强制光标），实现脆弱怪异。
- **首行缩进是假的**：靠 `paddingLeft: 2em` 把整段左移，多段落时并非「每段段首空两格」，不符合中文排版习惯。
- **写作模式**只是隐藏两侧，没有真正沉浸式排版（护眼底色、段间距、字号档位），且 textarea 本身限制仍在。
- **人物卡注入** `apps/desktop/src/main/agents/index.ts` 取 `characters.slice(0, 3)`，与当前章节出场人物无关，长篇里基本注入错人；近文硬编码截 4000 字。
- **状态栏信息单薄**：没有全书/本卷字数、当前模型 provider、上次保存时间。
- **缺关键快捷键**：没有可靠 `⌘Z`、没有「一键触发续写」、`⌘F` 无查找。

---

## 优先级建议（投入产出比从高到低）

1. **AI 写入改为「光标处插入 / 选区替换」**，并让编辑器跟随滚动 —— 直接救活润色/续写体验。
2. **接入 Monaco（或至少修复受控 textarea 的 undo + 大文本性能）** —— 解决撤销和卡顿。
3. **保存失败提示 + 章节版本快照** —— 保命。
4. **真·停止生成（加 `AgentStop` IPC + AbortController）+ Agent 类型切换 UI**。
5. **修字数统计与每日目标的重置/持久化**。
