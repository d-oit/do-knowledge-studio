export type { LLMMessage, LLMRequest, LLMResponse, LLMStreamChunk, LLMProviderConfig, LLMProvider, ToolDefinition, ToolCall, ToolResult } from './types';
export { OpenRouterProvider } from './openrouter';
export { KiloGatewayProvider } from './kilo';
export { AnthropicProvider } from './anthropic';
export { OllamaProvider } from './ollama';
export { loadConfig, saveConfig, createProvider, getProvider, type LLMConfig } from './config';
export { OPENROUTER_FREE_MODELS } from './openrouter';
export { KILO_FREE_MODELS } from './kilo';
export { BUILT_IN_TOOLS } from './tool-registry';
export { executeTool, type ToolExecutionContext } from './tool-executor';
export { ANTHROPIC_MODELS } from './anthropic';
export { OLLAMA_MODELS } from './ollama';

export const PROVIDER_MODELS: Record<string, Record<string, string>> = {
  openrouter: {
    'Gemini 2.0 Flash Lite': 'google/gemini-2.0-flash-lite-preview-02-05:free',
    'OpenRouter Free': 'openrouter/free',
    'Nemotron 3 Super': 'nvidia/nemotron-3-super:free',
    'Trinity Large': 'arcee-ai/trinity-large-preview:free',
    'GLM 4.5 Air': 'z-ai/glm-4.5-air:free',
    'GPT-OSS 120B': 'openai/gpt-oss-120b:free',
    'Qwen3 Coder': 'qwen/qwen3-coder-480b-a35b:free',
    'LLaMA 3.3 70B': 'meta-llama/llama-3.3-70b-instruct:free',
  },
  kilo: {
    'Kilo Auto': 'kilo-auto/free',
    'DoLa Seed 2.0 Pro': 'bytedance-seed/dola-seed-2.0-pro:free',
    'Grok Code Fast': 'x-ai/grok-code-fast-1:optimized:free',
    'Nemotron 3 Super': 'nvidia/nemotron-3-super-120b-a12b:free',
    'Trinity Large': 'arcee-ai/trinity-large-thinking:free',
    'OpenRouter Free': 'openrouter/free',
  },
  anthropic: {
    'Claude Sonnet 4': 'claude-sonnet-4-20250514',
    'Claude Haiku 3.5': 'claude-3-5-haiku-20241022',
    'Claude Sonnet 3.5': 'claude-3-5-sonnet-20241022',
    'Claude Opus 4': 'claude-opus-4-20250514',
  },
  ollama: {
    'Llama 3.2': 'llama3.2',
    'Llama 3.1': 'llama3.1',
    'Mistral': 'mistral',
    'CodeLlama': 'codellama',
    'Qwen 2.5': 'qwen2.5',
    'Gemma 2': 'gemma2',
  },
};
