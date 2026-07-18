'use client'

import type { LucideIcon } from 'lucide-react'
import type { AIProvider } from '@/lib/studio/ai-settings'
import {
  PROVIDER_LABELS,
  OPENROUTER_DEFAULT_MODELS,
  OLLAMA_DEFAULT_MODELS,
} from '@/lib/ai/types'

export interface ProviderOption {
  id: AIProvider
  label: string
  models: string[]
  requiresKey: boolean
}

export const PROVIDERS: ProviderOption[] = [
  { id: 'openrouter', label: PROVIDER_LABELS.openrouter, models: OPENROUTER_DEFAULT_MODELS, requiresKey: true },
  { id: 'ollama', label: PROVIDER_LABELS.ollama, models: OLLAMA_DEFAULT_MODELS, requiresKey: false },
]


export function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string
  icon: LucideIcon
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-label font-semibold uppercase tracking-wide text-ink-faint">
        <Icon className="h-3 w-3" />
        {label}
      </label>
      {children}
    </div>
  )
}
