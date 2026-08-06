'use client'

import * as React from 'react'
import type { LucideIcon } from 'lucide-react'
import type { AIProvider } from '@/lib/studio/ai-settings'
import {
  PROVIDER_LABELS,
  OPENROUTER_DEFAULT_MODELS,
  OLLAMA_DEFAULT_MODELS,
} from '@/lib/ai/types'

/** Configuration entry for a supported AI provider. */
export interface ProviderOption {
  id: AIProvider
  label: string
  models: string[]
  requiresKey: boolean
}

/** List of all supported AI providers with their default models and key requirements. */
export const PROVIDERS: ProviderOption[] = [
  { id: 'openrouter', label: PROVIDER_LABELS.openrouter, models: OPENROUTER_DEFAULT_MODELS, requiresKey: true },
  { id: 'ollama', label: PROVIDER_LABELS.ollama, models: OLLAMA_DEFAULT_MODELS, requiresKey: false },
]


/** Form field wrapper with auto-generated label and input ID binding. */
export const Field = ({
  label,
  icon: Icon,
  children,
}: {
  label: string
  icon: LucideIcon
  children: React.ReactNode
}) => {
  const fieldId = `field-${label.toLowerCase().replace(/\s+/g, '-')}`

  /** Recursively injects the field ID into the first input/select/textarea child. */
  function injectId(child: React.ReactNode): React.ReactNode {
    if (!React.isValidElement(child)) return child
    const el = child as React.ReactElement<Record<string, unknown>>
    const tag = typeof el.type === 'string' ? el.type : ''
    if (['input', 'select', 'textarea'].includes(tag)) {
      return React.cloneElement(el, { id: fieldId } as Record<string, unknown>)
    }
    if (el.props.children) {
      return React.cloneElement(el, {
        children: React.Children.map(el.props.children as React.ReactNode, injectId),
      })
    }
    return child
  }

  return (
    <div>
      <label
        htmlFor={fieldId}
        className="mb-1.5 flex items-center gap-1.5 text-label font-semibold uppercase tracking-wide text-ink-faint"
      >
        <Icon className="h-3 w-3" />
        {label}
      </label>
      {React.Children.map(children, injectId)}
    </div>
  )
}
