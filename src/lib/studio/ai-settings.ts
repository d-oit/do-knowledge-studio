const STORAGE_KEY = 'dks-ai-settings'

export type AIProvider = 'openai' | 'anthropic' | 'ollama'

export interface AISettings {
  provider: AIProvider
  model: string
  apiKey: string
  augmentWithLocal: boolean
}

const DEFAULT_SETTINGS: AISettings = {
  provider: 'ollama',
  model: 'llama3',
  apiKey: '',
  augmentWithLocal: true,
}

export function loadAISettings(): AISettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<AISettings>
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveAISettings(settings: AISettings): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // localStorage full or blocked — silently ignore
  }
}

export function getProviderEndpoint(provider: AIProvider): string {
  switch (provider) {
    case 'openai':
      return 'https://api.openai.com/v1/chat/completions'
    case 'anthropic':
      return 'https://api.anthropic.com/v1/messages'
    case 'ollama':
      return 'http://localhost:11434/api/chat'
  }
}
