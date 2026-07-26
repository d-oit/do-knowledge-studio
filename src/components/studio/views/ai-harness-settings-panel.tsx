'use client'

import {
  Database,
  Key,
  Cpu,
  Plug,
  Check,
  BookOpen,
  Zap,
  RefreshCw,
  Globe,
} from 'lucide-react'
import { type AIProvider } from '@/lib/studio/ai-settings'
import {
  OPENROUTER_ROUTERS,
  OPENROUTER_MODELS,
} from '@/lib/ai'
import { DEFAULT_MODEL, DEFAULT_OLLAMA_BASE_URL } from '@/lib/ai/types'
import { Field, PROVIDERS } from './ai-harness-settings'
import { SwitchToggle } from '../ui/shared-primitives'

interface SettingsPanelProps {
  provider: AIProvider
  setProvider: (p: AIProvider) => void
  model: string
  setModel: (m: string) => void
  apiKey: string
  setApiKey: (k: string) => void
  showKey: boolean
  setShowKey: (v: boolean) => void
  augment: boolean
  setAugment: (v: boolean) => void
  ollamaCpuOnly: boolean
  setOllamaCpuOnly: (v: boolean) => void
  ollamaBaseUrl: string
  setOllamaBaseUrl: (u: string) => void
  allowWebResearch: boolean
  setAllowWebResearch: (v: boolean) => void
  customModel: string
  setCustomModel: (m: string) => void
  ollamaModels: string[]
  handleRefreshOllamaModels: () => void | Promise<void>
  entityCount: number
  effectiveModel: string
  selectedEngineTarget: { slug: string; display_name: string; description?: string } | null
  isLoading: boolean
}

export function AiHarnessSettingsPanel({
  provider,
  setProvider,
  model,
  setModel,
  apiKey,
  setApiKey,
  showKey,
  setShowKey,
  augment,
  setAugment,
  ollamaCpuOnly,
  setOllamaCpuOnly,
  ollamaBaseUrl,
  setOllamaBaseUrl,
  allowWebResearch,
  setAllowWebResearch,
  customModel,
  setCustomModel,
  ollamaModels,
  handleRefreshOllamaModels,
  entityCount,
  effectiveModel,
  selectedEngineTarget,
  isLoading,
}: SettingsPanelProps) {
  const activeProvider = PROVIDERS.find((p) => p.id === provider) ?? PROVIDERS[0]

  return (
    <aside>
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-4 font-serif text-[15px] font-semibold text-ink">Provider</h2>

        <div className="space-y-3">
          <Field label="Connect Local Database" icon={Database}>
            <div className="flex w-full items-center rounded-md border border-border bg-background px-3 py-2 text-[12px] font-medium text-ink-soft">
              <span className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                Connected · {entityCount} entities
              </span>
            </div>
          </Field>

          <Field label="Provider" icon={Plug}>
            <select
              value={provider}
              onChange={(e) => {
                const val = e.target.value
                if (!PROVIDERS.some((pr) => pr.id === val)) return
                setProvider(val as AIProvider)
                const defaultModel = val === 'openrouter' ? DEFAULT_MODEL.openrouter : DEFAULT_MODEL.ollama
                setModel(defaultModel)
                setCustomModel('')
              }}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-[12px] font-medium text-ink-soft focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron/30"
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Engine" icon={Cpu}>
            <div className="flex gap-1.5">
              <select
                value={model}
                onChange={(e) => { setModel(e.target.value); setCustomModel('') }}
                className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-[12px] font-medium text-ink-soft focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron/30"
              >
                {provider === 'ollama' ? (
                  ollamaModels.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))
                ) : (
                  <>
                    <optgroup label="Routers">
                      {OPENROUTER_ROUTERS.map((r) => (
                        <option key={r.slug} value={r.slug}>
                          {r.display_name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Concrete Models">
                      {OPENROUTER_MODELS.map((m) => (
                        <option key={m.slug} value={m.slug}>
                          {m.display_name}
                        </option>
                      ))}
                    </optgroup>
                  </>
                )}
              </select>
              {provider === 'ollama' && (
                <button
                  onClick={() => { void handleRefreshOllamaModels() }}
                  className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-md border border-border bg-background text-ink-faint transition-colors hover:border-saffron/40 hover:text-saffron focus-ring"
                  aria-label="Refresh Ollama models"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <input
              type="text"
              value={customModel}
              onChange={(e) => { setCustomModel(e.target.value) }}
              placeholder="Or type a custom engine or model slug"
              aria-label="Custom engine or model slug"
              className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-[12px] font-mono text-ink-soft placeholder:text-ink-faint focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron/30"
            />
            {selectedEngineTarget?.description && (
              <div className="mt-2 rounded border border-border bg-muted/30 p-2 text-[11px] leading-relaxed text-ink-mute">
                <strong className="text-ink-soft">{selectedEngineTarget.display_name}: </strong>
                {selectedEngineTarget.description}
              </div>
            )}
          </Field>

          {activeProvider.requiresKey && (
            <Field label="API Key" icon={Key}>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => { setApiKey(e.target.value) }}
                  placeholder="sk-or-…"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 pr-16 text-[12px] font-mono text-ink placeholder:text-ink-faint focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron/30"
                />
                <button
                  onClick={() => { setShowKey(!showKey) }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-caption font-medium text-ink-faint hover:text-ink focus-ring"
                  aria-label={showKey ? 'Hide API key' : 'Show API key'}
                >
                  {showKey ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="mt-1.5 text-caption text-ink-faint">
                Stored in this browser only — sent directly to OpenRouter.
              </p>
            </Field>
          )}

          {provider === 'ollama' && (
            <>
              <Field label="Ollama Base URL" icon={Globe}>
                <input
                  type="text"
                  value={ollamaBaseUrl}
                  onChange={(e) => { setOllamaBaseUrl(e.target.value) }}
                  placeholder={DEFAULT_OLLAMA_BASE_URL}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-[12px] font-mono text-ink-soft placeholder:text-ink-faint focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron/30"
                />
              </Field>

              <SwitchToggle
                label="CPU only"
                description="Disable GPU acceleration"
                icon={Cpu}
                checked={ollamaCpuOnly}
                onToggle={() => { setOllamaCpuOnly(!ollamaCpuOnly) }}
              />
            </>
          )}

          <SwitchToggle
            label="Augment with local knowledge"
            description="BM25 retrieval over your entities"
            icon={BookOpen}
            checked={augment}
            onToggle={() => { setAugment(!augment) }}
          />

          <SwitchToggle
            label="Allow web research"
            description="Fetch URLs via Jina Reader"
            icon={Globe}
            checked={allowWebResearch}
            onToggle={() => { setAllowWebResearch(!allowWebResearch) }}
          />
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between text-label">
          <span className="flex items-center gap-1.5 text-ink-mute">
            <Zap className="h-3 w-3 text-saffron" />
            Status
          </span>
          <span className="font-mono text-ink">{isLoading ? 'Thinking…' : 'Ready'}</span>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-label">
          <span className="flex items-center gap-1.5 text-ink-mute">
            <Cpu className="h-3 w-3 text-ink-faint" />
            Active engine
          </span>
          <span className="font-mono text-ink-soft">{effectiveModel}</span>
        </div>
      </div>
    </aside>
  )
}
