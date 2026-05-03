import { useEffect, useState } from 'react'
import { useProjectStore } from '../stores/project'
import { IconSettings } from './Icons'
import type { Theme } from '../hooks/useTheme'

interface Settings {
  llmProvider: string
  llmModel: string
  llmApiKey: string
  llmBaseUrl: string
  dailyGoal: number
  fontSize: number
  fontFamily: string
}

const DEFAULT_SETTINGS: Settings = {
  llmProvider: 'mock',
  llmModel: '',
  llmApiKey: '',
  llmBaseUrl: '',
  dailyGoal: 5000,
  fontSize: 16,
  fontFamily: "'LXGW WenKai', 'Noto Serif SC', 'PingFang SC', serif"
}

interface SettingsPanelProps {
  open: boolean
  onClose: () => void
  theme: Theme
  onThemeChange: (t: Theme) => void
}

export function SettingsPanel({ open, onClose, theme, onThemeChange }: SettingsPanelProps): React.ReactElement | null {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    void loadSettings()
  }, [open])

  async function loadSettings(): Promise<void> {
    const s: Settings = {
      llmProvider: await window.api.settings.get('llm.provider', 'mock'),
      llmModel: await window.api.settings.get('llm.model', ''),
      llmApiKey: await window.api.settings.get('llm.apiKey', ''),
      llmBaseUrl: await window.api.settings.get('llm.baseUrl', ''),
      dailyGoal: await window.api.settings.get('daily.goal', 5000),
      fontSize: await window.api.settings.get('editor.fontSize', 16),
      fontFamily: await window.api.settings.get('editor.fontFamily', DEFAULT_SETTINGS.fontFamily)
    }
    setSettings(s)
  }

  async function handleSave(): Promise<void> {
    setSaving(true)
    await window.api.settings.set('llm.provider', settings.llmProvider)
    await window.api.settings.set('llm.model', settings.llmModel)
    await window.api.settings.set('llm.apiKey', settings.llmApiKey)
    await window.api.settings.set('llm.baseUrl', settings.llmBaseUrl)
    await window.api.settings.set('daily.goal', settings.dailyGoal)
    await window.api.settings.set('editor.fontSize', settings.fontSize)
    await window.api.settings.set('editor.fontFamily', settings.fontFamily)

    // 同步到 project store
    useProjectStore.setState({ dailyGoal: settings.dailyGoal })

    setSaving(false)
    onClose()
  }

  function update<K extends keyof Settings>(key: K, value: Settings[K]): void {
    setSettings((s) => ({ ...s, [key]: value }))
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-full max-w-[500px] max-h-[80vh] overflow-y-auto rounded-xl border border-surface-600 bg-surface-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题 */}
        <div className="sticky top-0 flex items-center justify-between border-b border-surface-600 bg-surface-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-1.5"><IconSettings size={14} /> 设置</h2>
          <button className="text-xs text-gray-400 hover:text-gray-200" onClick={onClose}>
            ESC 关闭
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* LLM 配置 */}
          <Section title="AI 模型配置">
            <Field label="Provider">
              <select
                className="input-field"
                value={settings.llmProvider}
                onChange={(e) => update('llmProvider', e.target.value)}
              >
                <option value="mock">Mock（离线测试）</option>
                <option value="openai">OpenAI</option>
                <option value="deepseek">DeepSeek</option>
                <option value="ollama">Ollama（本地）</option>
              </select>
            </Field>
            <Field label="模型名称">
              <input
                className="input-field"
                value={settings.llmModel}
                onChange={(e) => update('llmModel', e.target.value)}
                placeholder={
                  settings.llmProvider === 'openai'
                    ? 'gpt-4o-mini'
                    : settings.llmProvider === 'deepseek'
                      ? 'deepseek-chat'
                      : settings.llmProvider === 'ollama'
                        ? 'qwen2.5:7b'
                        : 'mock-1'
                }
              />
            </Field>
            {settings.llmProvider !== 'mock' && settings.llmProvider !== 'ollama' && (
              <Field label="API Key">
                <input
                  className="input-field"
                  type="password"
                  value={settings.llmApiKey}
                  onChange={(e) => update('llmApiKey', e.target.value)}
                  placeholder="sk-..."
                />
              </Field>
            )}
            {settings.llmProvider !== 'mock' && (
              <Field label="Base URL（可选）">
                <input
                  className="input-field"
                  value={settings.llmBaseUrl}
                  onChange={(e) => update('llmBaseUrl', e.target.value)}
                  placeholder="留空使用默认地址"
                />
              </Field>
            )}
          </Section>

          {/* 外观 */}
          <Section title="外观">
            <Field label="主题">
              <div className="flex gap-2">
                <button
                  className={`flex-1 rounded-lg border px-3 py-2.5 text-xs text-center transition-colors ${
                    theme === 'dark'
                      ? 'border-accent bg-accent-10 text-accent-light'
                      : 'border-surface-600 text-gray-400 hover:border-gray-400'
                  }`}
                  onClick={() => onThemeChange('dark')}
                >
                  <div className="text-base mb-1">🌙</div>
                  深色
                </button>
                <button
                  className={`flex-1 rounded-lg border px-3 py-2.5 text-xs text-center transition-colors ${
                    theme === 'light'
                      ? 'border-accent bg-accent-10 text-accent-light'
                      : 'border-surface-600 text-gray-400 hover:border-gray-400'
                  }`}
                  onClick={() => onThemeChange('light')}
                >
                  <div className="text-base mb-1">☀️</div>
                  浅色
                </button>
              </div>
            </Field>
          </Section>

          {/* 写作设置 */}
          <Section title="写作设置">
            <Field label="每日目标字数">
              <input
                className="input-field"
                type="number"
                min={500}
                max={50000}
                step={500}
                value={settings.dailyGoal}
                onChange={(e) => update('dailyGoal', parseInt(e.target.value) || 5000)}
              />
            </Field>
            <Field label="编辑器字号">
              <input
                className="input-field"
                type="number"
                min={12}
                max={24}
                value={settings.fontSize}
                onChange={(e) => update('fontSize', parseInt(e.target.value) || 16)}
              />
            </Field>
            <Field label="编辑器字体">
              <select
                className="input-field"
                value={settings.fontFamily}
                onChange={(e) => update('fontFamily', e.target.value)}
              >
                <option value="'LXGW WenKai', 'Noto Serif SC', 'PingFang SC', serif">
                  霞鹜文楷（推荐）
                </option>
                <option value="'Noto Serif SC', 'PingFang SC', serif">
                  Noto Serif SC
                </option>
                <option value="'PingFang SC', 'Microsoft YaHei', sans-serif">
                  苹方 / 微软雅黑
                </option>
                <option value="'Source Han Sans SC', sans-serif">
                  思源黑体
                </option>
              </select>
            </Field>
          </Section>
        </div>

        {/* 底部按钮 */}
        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-surface-600 bg-surface-800 px-4 py-3">
          <button
            className="rounded-lg px-4 py-1.5 text-xs text-gray-400 hover:bg-surface-600"
            onClick={onClose}
          >
            取消
          </button>
          <button
            className="rounded-lg bg-accent px-4 py-1.5 text-xs text-white hover:bg-accent-80 disabled:opacity-50"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '保存中…' : '保存设置'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  )
}
