/**
 * Magic Writer · AI 实体生成器
 *
 * 复用项目统一配置的 LLM（getLLMGateway，默认走设置面板中的 DeepSeek/OpenAI 等），
 * 随机生成角色 / 道具 / 地点 / 事件 / 伏笔，解析为结构化实体并存入统一实体表。
 * 当 provider 为 mock 或 LLM 输出无法解析时，使用本地兜底随机生成，保证离线可用。
 */
import type {
  Entity,
  EntityType,
  AgentMessage
} from '@magic-writer/shared'
import { getLLMGateway } from '../llm'
import { getProject, upsertEntity } from '../storage'

const SUPPORTED: EntityType[] = ['character', 'event', 'location', 'prop', 'foreshadowing']

const TYPE_LABEL: Record<EntityType, string> = {
  character: '角色',
  event: '事件',
  location: '地点',
  prop: '道具',
  foreshadowing: '伏笔',
  chapter: '章节',
  storyline: '线索'
}

/** 各类型期望的 JSON 结构说明（写入 prompt） */
const TYPE_SCHEMA: Partial<Record<EntityType, string>> = {
  character: `{
  "name": "角色姓名",
  "aliases": ["别名1", "别名2"],
  "age": 数字或null,
  "appearance": "外貌描写",
  "personality": "性格描写",
  "abilities": ["能力1", "能力2"]
}`,
  prop: `{
  "name": "道具名称",
  "category": "类别（法宝/丹药/功法/凡物等）",
  "description": "道具描述",
  "abilities": ["效果1", "效果2"]
}`,
  location: `{
  "name": "地点名称",
  "region": "所属区域",
  "description": "环境描写",
  "significance": "在故事中的意义"
}`,
  event: `{
  "name": "事件名称",
  "time": "发生时间（可虚构）",
  "location": "发生地点",
  "participants": ["人物1", "人物2"],
  "detail": "事件经过"
}`,
  foreshadowing: `{
  "description": "伏笔内容描述"
}`
}

export async function generateEntity(
  projectId: string,
  type: EntityType,
  hint?: string
): Promise<Entity> {
  if (!SUPPORTED.includes(type)) {
    throw new Error(`不支持生成的实体类型：${type}`)
  }

  const project = getProject(projectId)
  const projectCtx = project
    ? `作品《${project.title}》，题材：${project.genre || '未指定'}，简介：${project.logline || '无'}。`
    : ''

  let parsed: Record<string, unknown> | null = null

  const provider = getLLMGateway().getDefaultConfig().provider
  if (provider !== 'mock') {
    try {
      parsed = await callLLM(type, projectCtx, hint)
    } catch {
      parsed = null
    }
  }

  if (!parsed) {
    parsed = mockGenerate(type)
  }

  const { name, summary, data } = normalize(type, parsed)

  return upsertEntity({
    projectId,
    type,
    name,
    summary,
    data,
    tags: ['ai-generated']
  })
}

// ============================================================
// LLM 调用
// ============================================================

async function callLLM(
  type: EntityType,
  projectCtx: string,
  hint?: string
): Promise<Record<string, unknown>> {
  const schema = TYPE_SCHEMA[type] ?? '{}'
  const messages: AgentMessage[] = [
    {
      role: 'system',
      content:
        '你是一名网文设定大师。请根据要求随机生成一个富有创意、细节饱满的设定，' +
        '只能输出一个 JSON 对象，不要任何解释、不要使用 markdown 代码块。',
      ts: Date.now()
    },
    {
      role: 'user',
      content:
        `${projectCtx}\n请随机生成一个「${TYPE_LABEL[type]}」设定。` +
        (hint ? `\n额外要求：${hint}` : '') +
        `\n严格按照以下 JSON 结构输出（字段名保持一致）：\n${schema}`,
      ts: Date.now()
    }
  ]

  let full = ''
  for await (const ev of getLLMGateway().stream(messages, { temperature: 1.0 })) {
    full += ev.delta
    if (ev.done) break
  }

  const json = extractJSON(full)
  if (!json) throw new Error('LLM 未返回可解析的 JSON')
  return json
}

function extractJSON(text: string): Record<string, unknown> | null {
  // 去除可能的 ```json ``` 包裹
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return null
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1))
    return typeof obj === 'object' && obj ? (obj as Record<string, unknown>) : null
  } catch {
    return null
  }
}

// ============================================================
// 归一化为统一实体的 name/summary/data
// ============================================================

function normalize(
  type: EntityType,
  raw: Record<string, unknown>
): { name: string; summary: string; data: Record<string, unknown> } {
  const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean) : []

  switch (type) {
    case 'character': {
      const name = str(raw.name) || '无名角色'
      const data = {
        aliases: arr(raw.aliases),
        age: typeof raw.age === 'number' ? raw.age : undefined,
        appearance: str(raw.appearance),
        personality: str(raw.personality),
        abilities: arr(raw.abilities),
        lockedFields: [] as string[]
      }
      return { name, summary: data.personality, data }
    }
    case 'prop': {
      const name = str(raw.name) || '无名道具'
      const data = {
        category: str(raw.category),
        description: str(raw.description),
        abilities: arr(raw.abilities)
      }
      return { name, summary: data.description, data }
    }
    case 'location': {
      const name = str(raw.name) || '无名之地'
      const data = {
        region: str(raw.region),
        description: str(raw.description),
        significance: str(raw.significance)
      }
      return { name, summary: data.description, data }
    }
    case 'event': {
      const name = str(raw.name) || '未命名事件'
      const data = {
        time: str(raw.time),
        location: str(raw.location),
        participants: arr(raw.participants),
        detail: str(raw.detail)
      }
      return { name, summary: data.detail, data }
    }
    case 'foreshadowing': {
      const description = str(raw.description) || str(raw.name) || '未描述的伏笔'
      return {
        name: description,
        summary: description,
        data: { plantedAt: { chapterId: '', offset: 0 }, status: 'pending' }
      }
    }
    default:
      return { name: str(raw.name), summary: '', data: raw }
  }
}

// ============================================================
// 本地兜底随机生成（mock / 解析失败时）
// ============================================================

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function mockGenerate(type: EntityType): Record<string, unknown> {
  switch (type) {
    case 'character':
      return {
        name: pick(['沈墨白', '苏清欢', '陆惊鸿', '叶孤城', '宋长安']),
        aliases: [pick(['无情剑客', '药师', '小师妹', '北境之王'])],
        age: 16 + Math.floor(Math.random() * 30),
        appearance: pick([
          '一袭青衫，眉目如画，腰悬古剑',
          '白发红瞳，气质清冷，不染纤尘',
          '身形魁梧，面带刀疤，目光如电'
        ]),
        personality: pick([
          '表面冷漠，内心赤诚，重情重义',
          '心思缜密，喜怒不形于色',
          '洒脱不羁，嗜酒如命，剑法通神'
        ]),
        abilities: [pick(['御剑术', '丹道', '炼器', '神识']), pick(['瞬步', '雷法', '幻术'])]
      }
    case 'prop':
      return {
        name: pick(['噬魂幡', '太虚剑', '九转还魂丹', '混沌珠', '焚天炉']),
        category: pick(['法宝', '丹药', '功法', '本命飞剑']),
        description: pick([
          '上古遗留的神兵，蕴含一缕真龙之气',
          '服下可起死回生，世间仅存三枚',
          '炼器宗师耗时百年所铸，威能无穷'
        ]),
        abilities: [pick(['吞噬元神', '斩断因果', '淬炼肉身'])]
      }
    case 'location':
      return {
        name: pick(['青云宗', '万妖谷', '幽冥海', '落日神都', '忘川']),
        region: pick(['东域', '北荒', '南疆', '中州']),
        description: pick([
          '云雾缭绕，仙鹤盘旋，灵气浓郁',
          '终年阴风怒号，白骨遍野，凶兽横行',
          '繁华盛世，万国来朝，高手如云'
        ]),
        significance: pick(['主角的起点', '决战之地', '上古秘宝所在'])
      }
    case 'event':
      return {
        name: pick(['宗门大比', '魔渊开启', '皇朝倾覆', '天降异象']),
        time: pick(['三年一度', '百年一遇', '故事开篇之夜']),
        location: pick(['青云宗演武场', '幽冥海眼', '落日神都']),
        participants: [pick(['主角', '反派宗主']), pick(['师尊', '红颜知己'])],
        detail: pick([
          '一场看似公平的比试，背后却藏着惊天阴谋',
          '封印松动，无数凶兽涌出，生灵涂炭',
          '一道天雷劈下，命运的齿轮开始转动'
        ])
      }
    case 'foreshadowing':
      return {
        description: pick([
          '主角胸口的玉佩在月圆之夜会微微发烫',
          '神秘老者临别时那句意味深长的话',
          '反派始终戴着的面具下，藏着一张熟悉的脸'
        ])
      }
    default:
      return {}
  }
}
