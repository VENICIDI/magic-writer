/**
 * Magic Writer · Style Learner
 *
 * 从用户已有章节中提取代表性段落，作为 few-shot 风格样本注入 Agent prompt。
 * 让 AI 续写时保持"我的文风"。
 */
import { getDB, getDataDir } from '../storage/database'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

export interface StyleSample {
  /** 段落文本（300~600 字） */
  text: string
  /** 来源章节 ID */
  chapterId: string
  /** 段落类型标签 */
  type: 'narration' | 'dialogue' | 'action' | 'description'
}

/**
 * 从项目中提取风格样本（最多 3 段）
 */
export function extractStyleSamples(projectId: string, maxSamples = 3): StyleSample[] {
  const db = getDB()
  const chapters = db
    .prepare(
      'SELECT id, file_path, word_count FROM chapters WHERE project_id = ? AND word_count > 200 ORDER BY sort_order'
    )
    .all(projectId) as Array<{ id: string; file_path: string; word_count: number }>

  if (chapters.length === 0) return []

  const samples: StyleSample[] = []
  const dataDir = getDataDir()

  for (const ch of chapters) {
    if (samples.length >= maxSamples) break

    const filePath = join(dataDir, 'chapters', ch.file_path)
    if (!existsSync(filePath)) continue

    const content = readFileSync(filePath, 'utf-8')
    const paragraphs = extractParagraphs(content)

    for (const para of paragraphs) {
      if (samples.length >= maxSamples) break
      if (para.length >= 200 && para.length <= 600) {
        samples.push({
          text: para,
          chapterId: ch.id,
          type: classifyParagraph(para)
        })
      }
    }
  }

  return samples
}

/**
 * 将风格样本格式化为 prompt 注入文本
 */
export function formatStylePrompt(samples: StyleSample[]): string {
  if (samples.length === 0) return ''

  const parts = ['【作者文风样本（请模仿此风格续写）】\n']

  for (let i = 0; i < samples.length; i++) {
    parts.push(`样本${i + 1}（${typeLabel(samples[i].type)}）：`)
    parts.push(samples[i].text)
    parts.push('')
  }

  return parts.join('\n')
}

// ============================================================
// 工具函数
// ============================================================

function extractParagraphs(content: string): string[] {
  return content
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => {
      // 排除标题行、空行、待续写占位
      if (p.startsWith('#')) return false
      if (p.length < 100) return false
      if (p.includes('（待续写）')) return false
      return true
    })
}

function classifyParagraph(text: string): StyleSample['type'] {
  const dialogueRatio = (text.match(/["""]/g)?.length ?? 0) / text.length
  if (dialogueRatio > 0.02) return 'dialogue'

  const actionWords = /[跑跳打踢飞冲闪挡劈刺]/g
  if ((text.match(actionWords)?.length ?? 0) > 3) return 'action'

  const descWords = /[碧绿湛蓝金色银白雄伟巍峨壮观幽深]/g
  if ((text.match(descWords)?.length ?? 0) > 2) return 'description'

  return 'narration'
}

function typeLabel(type: StyleSample['type']): string {
  switch (type) {
    case 'narration': return '叙述'
    case 'dialogue': return '对话'
    case 'action': return '动作'
    case 'description': return '环境描写'
  }
}
