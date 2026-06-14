import { app } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import {
  configureWorldview,
  startWorldviewServer,
  type WorldviewServerHandle
} from '@magic-writer/worldview-analyzer'
import type { LLMProvider } from '@magic-writer/shared'
import { getSetting } from '../storage'

let server: WorldviewServerHandle | null = null

function defaultBaseUrl(provider: LLMProvider): string | undefined {
  switch (provider) {
    case 'openai':
      return 'https://api.openai.com/v1'
    case 'deepseek':
      return 'https://api.deepseek.com/v1'
    case 'ollama':
      return 'http://127.0.0.1:11434/v1'
    default:
      return undefined
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
      return 'gpt-4o-mini'
  }
}

function readLlmConfig(): { apiKey?: string; baseUrl?: string; model?: string } | undefined {
  const provider = (getSetting<string>('llm.provider', '') ||
    process.env.MW_LLM_PROVIDER ||
    'mock') as LLMProvider

  if (provider === 'mock') {
    return undefined
  }

  const apiKey =
    getSetting<string>('llm.apiKey', '') || process.env.MW_LLM_API_KEY || process.env.LLM_API_KEY
  const baseUrl =
    getSetting<string>('llm.baseUrl', '') ||
    process.env.MW_LLM_BASE_URL ||
    defaultBaseUrl(provider)
  const model =
    getSetting<string>('llm.model', '') || process.env.MW_LLM_MODEL || defaultModel(provider)

  return {
    apiKey: apiKey || undefined,
    baseUrl: baseUrl || undefined,
    model: model || undefined
  }
}

function getPublicDir(): string {
  if (is.dev) {
    return join(app.getAppPath(), '..', '..', 'packages', 'worldview-analyzer', 'public')
  }
  return join(__dirname, 'worldview-public')
}

export async function startWorldviewService(): Promise<WorldviewServerHandle> {
  if (server) return server

  const llm = readLlmConfig()
  server = await startWorldviewServer({
    dataDir: join(app.getPath('userData'), 'worldview-analyzer'),
    publicDir: getPublicDir(),
    apiHost: '127.0.0.1',
    apiPort: 0,
    llm
  })

  return server
}

export function getWorldviewUrl(): string | null {
  return server?.url ?? null
}

export async function refreshWorldviewLlmConfig(): Promise<void> {
  const llm = readLlmConfig()
  configureWorldview({ llm })
}

export async function stopWorldviewService(): Promise<void> {
  if (!server) return
  await server.stop()
  server = null
}
