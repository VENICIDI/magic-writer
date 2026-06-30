import { AgentOrchestrator, type AgentContext } from '@magic-writer/agent-core'
import type { AgentRunRequest } from '@magic-writer/shared'
import type { LLMStreamEvent } from '@magic-writer/llm-gateway'
import { getLLMGateway } from '../llm'
import { getChapterContent, listCharacters, getSetting } from '../storage'
import { getRAGEngine } from './rag-engine'
import { extractStyleSamples, formatStylePrompt } from './style-learner'

let orchestrator: AgentOrchestrator | null = null

function getOrchestrator(): AgentOrchestrator {
  if (!orchestrator) orchestrator = new AgentOrchestrator(getLLMGateway())
  return orchestrator
}

/** 供 IPC 层消费：给定请求，产出流式事件 */
export async function* runAgent(
  req: AgentRunRequest,
  signal?: AbortSignal
): AsyncIterable<LLMStreamEvent> {
  const context: AgentContext = {}

  // 1. 获取当前章节近文
  if (req.chapterId) {
    const c = await getChapterContent(req.chapterId)
    if (c) {
      const text = c.content
      context.recentText = text.length > 4000 ? text.slice(-4000) : text
      context.chapterOutline = c.chapter.outline || undefined
    }
  }

  // 2. 获取相关人物卡
  if (req.projectId) {
    try {
      const characters = listCharacters(req.projectId)
      if (characters.length > 0) {
        // 最多注入 3 张人物卡
        const cards = characters.slice(0, 3).map((ch) => {
          const parts = [`## ${ch.name}`]
          if (ch.aliases.length) parts.push(`别名：${ch.aliases.join('、')}`)
          if (ch.age) parts.push(`年龄：${ch.age}`)
          if (ch.appearance) parts.push(`外貌：${ch.appearance}`)
          if (ch.personality) parts.push(`性格：${ch.personality}`)
          if (ch.abilities.length) parts.push(`能力：${ch.abilities.join('、')}`)
          return parts.join('\n')
        })
        context.characterCards = cards.join('\n\n---\n\n')
      }
    } catch {
      // 人物卡获取失败不阻塞主流程
    }
  }

  // 3. RAG 检索相关前文
  if (req.projectId && context.recentText) {
    try {
      const rag = getRAGEngine()
      const query = context.recentText.slice(-500) // 用近 500 字做检索
      const hits = await rag.search(query, 5, req.projectId)
      if (hits.length > 0) {
        context.ragSnippets = hits.map((h) => h.text)
      }
    } catch {
      // RAG 检索失败不阻塞
    }
  }

  // 4. 用户选区
  if (req.selection) {
    context.selection = req.selection
  }

  // 5. 风格学习样本（仅续写和润色时注入）
  if (req.projectId && (req.agentType === 'writer' || req.agentType === 'polish')) {
    try {
      const styleEnabled = getSetting<boolean>('style.enabled', true)
      if (styleEnabled) {
        const samples = extractStyleSamples(req.projectId, 2)
        if (samples.length > 0) {
          const styleText = formatStylePrompt(samples)
          // 将风格样本追加到 characterCards 字段（复用已有通道）
          context.characterCards = context.characterCards
            ? `${context.characterCards}\n\n${styleText}`
            : styleText
        }
      }
    } catch {
      // 风格提取失败不阻塞
    }
  }

  yield* getOrchestrator().run({
    type: req.agentType,
    input: req.input,
    context,
    signal
  })
}
