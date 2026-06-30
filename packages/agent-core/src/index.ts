import type {
  AgentMessage,
  AgentType,
  LLMConfig
} from '@magic-writer/shared'
import { LLMGateway, type LLMStreamEvent } from '@magic-writer/llm-gateway'

// ---------- 每种 Agent 的 system prompt ----------

export const AGENT_PROMPTS: Record<AgentType, string> = {
  writer: `你是一名中文网文领域的资深责编兼续写助手。请严格遵守：
1. 以提供的"前文"、"本章大纲"、"人物卡"为唯一事实来源，不得凭空添加设定。
2. 保持既有人设、文风、叙述视角与人称不变。
3. 只输出正文段落，不要写 AI 解释、不要写 Markdown 标题。
4. 每次续写 300~800 字，节奏紧凑，结尾留有推进感。`,

  polish: `你是一名文字润色师。请严格保留原文语义与情节，不要增加新信息。
按用户指定的模式（文笔/节奏/对话/去口水话等）改写，保持人物口吻一致。
只输出润色后的正文，不要解释。`,

  outline: `你是一名网文大纲策划。根据用户给的题材、主角和卖点，产出结构化大纲：
三幕 → 分卷 → 分章梗概（每章 1~2 句）。
输出 JSON，字段：{ acts: [{ title, volumes: [{ title, chapters: [{ title, summary }] }] }] }。`,

  review: `你是一名小说审校。根据全文上下文，检查：
- 人物一致性（性格、能力、口头禅、年龄）
- 时间线冲突
- 伏笔埋点与回收
输出 JSON 数组：[{ type, severity: 'high'|'mid'|'low', chapterId, description, suggestion }]。`,

  world: `你是一名世界观整理助手。从正文中提取新出现的实体（人物/地点/势力/物品），
与已有世界观库去重后，输出需要新增或更新的条目。尊重已锁定字段，不得修改。`
}

// ---------- Agent 输入 ----------

export interface AgentContext {
  /** 最近编辑的 N 字，必传（续写主要依赖） */
  recentText?: string
  /** 本章大纲 */
  chapterOutline?: string
  /** 相关人物卡（Markdown 文本） */
  characterCards?: string
  /** RAG 检索到的相似片段 */
  ragSnippets?: string[]
  /** 用户选区（润色用） */
  selection?: string
}

export interface RunAgentInput {
  type: AgentType
  input: string
  context?: AgentContext
  config?: Partial<LLMConfig>
  /** 用于中断生成 */
  signal?: AbortSignal
}

// ---------- 构造最终 messages ----------

function buildMessages(input: RunAgentInput): AgentMessage[] {
  const now = Date.now()
  const system: AgentMessage = {
    role: 'system',
    content: AGENT_PROMPTS[input.type],
    ts: now
  }

  const ctx = input.context ?? {}
  const contextParts: string[] = []
  if (ctx.chapterOutline) contextParts.push(`【本章大纲】\n${ctx.chapterOutline}`)
  if (ctx.characterCards) contextParts.push(`【相关人物】\n${ctx.characterCards}`)
  if (ctx.ragSnippets?.length)
    contextParts.push(`【相关前文】\n${ctx.ragSnippets.join('\n---\n')}`)
  if (ctx.recentText) contextParts.push(`【最近正文】\n${ctx.recentText}`)
  if (ctx.selection) contextParts.push(`【用户选区】\n${ctx.selection}`)

  const userContent = [
    contextParts.join('\n\n'),
    contextParts.length ? '\n\n---\n' : '',
    `【指令】${input.input}`
  ]
    .filter(Boolean)
    .join('')

  return [system, { role: 'user', content: userContent, ts: now }]
}

// ---------- Orchestrator ----------

export class AgentOrchestrator {
  constructor(private readonly gateway: LLMGateway) {}

  async *run(input: RunAgentInput): AsyncIterable<LLMStreamEvent> {
    const messages = buildMessages(input)
    yield* this.gateway.stream(messages, input.config, input.signal)
  }
}

export * from './router'
