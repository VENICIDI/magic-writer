import type { AgentType } from '@magic-writer/shared'

/**
 * 简单的规则式 Router Agent：根据用户输入推断意图。
 * 后续可以替换为调用 LLM 做意图分类。
 */
export function routeIntent(input: string, hasSelection: boolean): AgentType {
  const s = input.trim()
  if (!s) return 'writer'

  if (hasSelection) {
    if (/(润色|改写|换风格|缩写|扩写|去.{0,3}味)/.test(s)) return 'polish'
    if (/(审校|检查|一致性|冲突)/.test(s)) return 'review'
    return 'polish'
  }

  if (/(大纲|三幕|分卷|分章)/.test(s)) return 'outline'
  if (/(审校|检查|一致性|伏笔|时间线)/.test(s)) return 'review'
  if (/(人物|世界观|地点|势力)/.test(s)) return 'world'
  return 'writer'
}
