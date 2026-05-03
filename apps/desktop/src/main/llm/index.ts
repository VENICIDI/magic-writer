import { LLMGateway } from '@magic-writer/llm-gateway'
import type { LLMConfig, LLMProvider } from '@magic-writer/shared'
import { getSetting } from '../storage'

/**
 * LLM 配置优先级：
 * 1. SQLite settings（用户通过设置面板配置的）
 * 2. 环境变量（开发/部署时配置的）
 * 3. 默认值（mock）
 */
function readConfig(): Partial<LLMConfig> {
  // 先尝试从 SQLite 读取
  const provider = getSetting<string>('llm.provider', '') || process.env.MW_LLM_PROVIDER || 'mock'
  const model = getSetting<string>('llm.model', '') || process.env.MW_LLM_MODEL || defaultModel(provider as LLMProvider)
  const apiKey = getSetting<string>('llm.apiKey', '') || process.env.MW_LLM_API_KEY || undefined
  const baseURL = getSetting<string>('llm.baseUrl', '') || process.env.MW_LLM_BASE_URL || undefined

  return {
    provider: provider as LLMProvider,
    model,
    apiKey: apiKey || undefined,
    baseURL: baseURL || undefined
  }
}

function defaultModel(provider: LLMProvider): string {
  switch (provider) {
    case 'openai':
      return 'gpt-4o-mini'
    case 'deepseek':
      return 'deepseek-chat'
    case 'ollama':
      return 'qwen2.5:7b'
    default:
      return 'mock-1'
  }
}

let gateway: LLMGateway | null = null

export function getLLMGateway(): LLMGateway {
  if (!gateway) {
    gateway = new LLMGateway(readConfig())
  } else {
    // 每次获取时刷新配置（支持设置面板动态切换）
    gateway.setDefaultConfig(readConfig())
  }
  return gateway
}

/**
 * 强制刷新 Gateway 配置（设置面板保存后调用）
 */
export function refreshLLMConfig(): void {
  if (gateway) {
    gateway.setDefaultConfig(readConfig())
  }
}
