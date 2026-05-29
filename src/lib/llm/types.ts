export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMRequest {
  model: string;
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface LLMStreamChunk {
  content: string;
  done: boolean;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface LLMProviderConfig {
  apiKey?: string;
  baseURL: string;
  defaultModel?: string;
  defaultHeaders?: Record<string, string>;
}

export interface LLMProvider {
  id: string;
  name: string;
  config: LLMProviderConfig;
  chat(request: LLMRequest): Promise<LLMResponse>;
  chatStream(request: LLMRequest): AsyncGenerator<LLMStreamChunk>;
  isConfigured(): boolean;
}

/** OpenAI-compatible chat completion response body. */
export interface OpenAIChatResponse {
  choices: Array<{
    message?: { content?: string };
    delta?: { content?: string };
  }>;
  model?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}

/** OpenAI-compatible error response body. */
export interface OpenAIErrorResponse {
  error?: { message?: string };
}
