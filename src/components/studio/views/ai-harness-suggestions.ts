import type { Entity, Claim } from '@/lib/studio/types'

/** A labeled prompt suggestion shown in the AI Harness chat welcome screen. */
export interface PromptSuggestion {
  label: string
  prompt: string
}

const MAX_SUGGESTIONS = 3

/**
 * Builds progressive prompt suggestions based on the current knowledge base
 * context: what the user has captured (entities/claims) and what is selected.
 * Shown in the AI Harness chat before the first user message so first-use
 * screens stay guided without exposing the full prompt surface.
 */
export const buildContextSuggestions = (
  entities: Entity[],
  claims: Claim[],
  selectedEntityId: string | null,
): PromptSuggestion[] => {
  const suggestions: PromptSuggestion[] = []

  const selected = entities.find((e) => e.id === selectedEntityId)

  if (selected) {
    suggestions.push({
      label: `Explain “${selected.name}”`,
      prompt: `Explain what I know about “${selected.name}” and how it connects to my knowledge base.`,
    })
  }

  if (entities.length > 0) {
    suggestions.push({
      label: 'Summarize my library',
      prompt: 'Summarize the main entities and themes in my knowledge base.',
    })
    suggestions.push({
      label: 'Find connections',
      prompt: 'Find unexpected connections between my entities and claims.',
    })
  }

  if (claims.length > 0) {
    suggestions.push({
      label: 'Review my claims',
      prompt: 'List my claims and point out any that need verification.',
    })
  }

  if (suggestions.length === 0) {
    suggestions.push({
      label: 'How does this work?',
      prompt: 'How does the AI Harness work, and what can I ask it about my local knowledge?',
    })
  }

  return suggestions.slice(0, MAX_SUGGESTIONS)
}
