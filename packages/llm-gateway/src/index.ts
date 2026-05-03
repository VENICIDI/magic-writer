import type {
  AgentMessage,
  LLMConfig,
  LLMProvider
} from '@magic-writer/shared'

export interface LLMStreamEvent {
  delta: string
  done: boolean
}

export interface LLMProviderAdapter {
  readonly name: LLMProvider
  stream(messages: AgentMessage[], config: LLMConfig): AsyncIterable<LLMStreamEvent>
}

// ---------- Mock Provider（离线可用，便于开发/测试） ----------

class MockProvider implements LLMProviderAdapter {
  readonly name: LLMProvider = 'mock'

  async *stream(messages: AgentMessage[]): AsyncIterable<LLMStreamEvent> {
    const last = messages[messages.length - 1]?.content ?? ''
    const reply =
      `（Mock 回复）你说的是："${last.slice(0, 40)}${last.length > 40 ? '…' : ''}"。\n\n` +
      '这是一段由本地占位模型生成的示例续写，真正接入 OpenAI/DeepSeek/Ollama 之前，' +
      '可以先用它验证流式渲染、IPC 链路、Agent 编排是否通畅。'
    // 伪流式：逐字吐出
    for (const ch of reply) {
      await sleep(8)
      yield { delta: ch, done: false }
    }
    yield { delta: '', done: true }
  }
}

// ---------- OpenAI 兼容 Provider（OpenAI / DeepSeek / Ollama 都走这条） ----------

class OpenAICompatibleProvider implements LLMProviderAdapter {
  constructor(readonly name: LLMProvider) {}

  async *stream(
    messages: AgentMessage[],
    config: LLMConfig
  ): AsyncIterable<LLMStreamEvent> {
    const url = (config.baseURL?.replace(/\/$/, '') ?? defaultBaseURL(config.provider)) +
      '/chat/completions'

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {})
      },
      body: JSON.stringify({
        model: config.model,
        temperature: config.temperature ?? 0.8,
        max_tokens: config.maxTokens ?? 2048,
        stream: true,
        messages: messages.map((m) => ({ role: m.role, content: m.content }))
      })
    })

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '')
      throw new Error(`LLM HTTP ${res.status}: ${text.slice(0, 200)}`)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buf = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const raw of lines) {
        const line = raw.trim()
        if (!line.startsWith('data:')) continue
        const payload = line.slice(5).trim()
        if (payload === '[DONE]') {
          yield { delta: '', done: true }
          return
        }
        try {
          const json = JSON.parse(payload)
          const delta: string = json.choices?.[0]?.delta?.content ?? ''
          if (delta) yield { delta, done: false }
        } catch {
          // 忽略心跳/非 JSON 行
        }
      }
    }
    yield { delta: '', done: true }
  }
}

function defaultBaseURL(provider: LLMProvider): string {
  switch (provider) {
    case 'openai':
      return 'https://api.openai.com/v1'
    case 'deepseek':
      return 'https://api.deepseek.com/v1'
    case 'ollama':
      return 'http://127.0.0.1:11434/v1'
    default:
      return 'https://api.openai.com/v1'
  }
}

// ---------- Gateway ----------

export class LLMGateway {
  private providers = new Map<LLMProvider, LLMProviderAdapter>()
  private defaultConfig: LLMConfig

  constructor(defaultConfig?: Partial<LLMConfig>) {
    this.defaultConfig = {
      provider: 'mock',
      model: 'mock-1',
      temperature: 0.8,
      maxTokens: 2048,
      ...defaultConfig
    }
    this.register(new MockProvider())
    this.register(new OpenAICompatibleProvider('openai'))
    this.register(new OpenAICompatibleProvider('deepseek'))
    this.register(new OpenAICompatibleProvider('ollama'))
  }

  register(p: LLMProviderAdapter): void {
    this.providers.set(p.name, p)
  }

  setDefaultConfig(config: Partial<LLMConfig>): void {
    this.defaultConfig = { ...this.defaultConfig, ...config }
  }

  getDefaultConfig(): LLMConfig {
    return { ...this.defaultConfig }
  }

  async *stream(
    messages: AgentMessage[],
    config?: Partial<LLMConfig>
  ): AsyncIterable<LLMStreamEvent> {
    const finalConfig: LLMConfig = { ...this.defaultConfig, ...config }
    const provider = this.providers.get(finalConfig.provider)
    if (!provider) {
      throw new Error(`Unknown LLM provider: ${finalConfig.provider}`)
    }
    yield* provider.stream(messages, finalConfig)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
