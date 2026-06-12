// --- Tool-calling types ---

export interface ToolParameterSchema {
  type: string;
  description: string;
  enum?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameterSchema>;
    required?: string[];
  };
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  content: string;
  isError?: boolean;
}

// --- Message types ---

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  /** Present when role is 'assistant' and the model invoked tools. */
  tool_calls?: ToolCall[];
  /** Present when role is 'tool'. */
  tool_call_id?: string;
}

export interface LLMRequest {
  model: string;
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  tools?: ToolDefinition[];
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  toolCalls?: ToolCall[];
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
    message?: {
      content?: string;
      tool_calls?: Array<{
        id: string;
        function: { name: string; arguments: string };
      }>;
    };
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
