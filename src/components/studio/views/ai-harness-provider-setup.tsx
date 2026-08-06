'use client'

import { KeyRound, Database, Sparkles } from 'lucide-react'

const PROVIDER_SETUP_TITLE = 'Connect an AI provider'
const PROVIDER_SETUP_DESCRIPTION = 'Add an API key to ask a hosted model, or switch to Ollama for a local model. Your prompt is sent to the selected provider; your library stays in this browser until you choose to include local context in a request.'
const PROVIDER_SETUP_CONTEXT_NOTE = 'With local augmentation on, selected notes and claims are included in requests. Turn it off to send only your prompt.'
const LOCAL_KNOWLEDGE_LABEL = 'Local knowledge stays available'
const AUTO_SAVE_LABEL = 'Settings save automatically'
const OPEN_PROVIDER_SETTINGS_LABEL = 'Open provider settings'

interface AiHarnessProviderSetupProps {
  onOpenSettings: () => void
}

/**
 * First-use guidance card shown when the selected provider requires an API key
 * that has not been configured yet. Progressive disclosure: explains the flow
 * and offers a single action to open settings.
 */
export function AiHarnessProviderSetup({ onOpenSettings }: AiHarnessProviderSetupProps) {
  return (
    <div
      className="mb-4 rounded-lg border border-saffron/30 bg-saffron-soft/40 p-4"
      role="region"
      aria-labelledby="provider-setup-title"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-saffron text-white">
          <KeyRound className="h-4 w-4" aria-hidden="true" />
        </div>
        <div>
          <h2 id="provider-setup-title" className="font-serif text-[15px] font-semibold text-ink">
            {PROVIDER_SETUP_TITLE}
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-mute">
            {PROVIDER_SETUP_DESCRIPTION}
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-mute">
            {PROVIDER_SETUP_CONTEXT_NOTE}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-label text-ink-soft">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1">
              <Database className="h-3 w-3 text-saffron-deep" aria-hidden="true" />
              {LOCAL_KNOWLEDGE_LABEL}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1">
              <Sparkles className="h-3 w-3 text-saffron-deep" aria-hidden="true" />
              {AUTO_SAVE_LABEL}
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenSettings}
            className="mt-3 min-h-[44px] rounded-md bg-primary px-3 py-1.5 text-label font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-ring"
          >
            {OPEN_PROVIDER_SETTINGS_LABEL}
          </button>
        </div>
      </div>
    </div>
  )
}
