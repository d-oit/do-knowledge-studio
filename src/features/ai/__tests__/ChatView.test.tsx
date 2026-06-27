import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../../lib/llm/markdown', () => ({
  default: ({ content }: { content: string }) => <div data-testid="markdown">{content}</div>,
}));

vi.mock('../../../lib/motion', () => ({
  scrollIntoViewSmooth: vi.fn(),
}));

import { ChatView } from '../ChatView';

const defaultProps = {
  messages: [
    { id: '1', role: 'user' as const, content: 'Hello' },
    { id: '2', role: 'assistant' as const, content: 'Hi there!' },
  ],
  isLoading: false,
  isSourcing: false,
  resolvedSources: [],
  sessionTokens: { input: 10, output: 20 },
  input: '',
  setInput: vi.fn(),
  onSend: vi.fn(),
  onClearChat: vi.fn(),
  onRemoveSource: vi.fn(),
  currentModel: 'gemini-2.0-flash',
  rateLimitLevel: 'none',
  rateLimitInfo: { count: 0, limit: 15 },
};

describe('ChatView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders messages', () => {
    render(<ChatView {...defaultProps} />);
    expect(screen.getByText('Hello')).toBeDefined();
    expect(screen.getByText('Hi there!')).toBeDefined();
  });

  it('renders user and assistant labels', () => {
    render(<ChatView {...defaultProps} />);
    expect(screen.getByText('You')).toBeDefined();
    expect(screen.getByText('Assistant')).toBeDefined();
  });

  it('renders token usage', () => {
    render(<ChatView {...defaultProps} />);
    expect(screen.getByText('Tokens: 30')).toBeDefined();
  });

  it('renders model name', () => {
    render(<ChatView {...defaultProps} />);
    expect(screen.getByText(/gemini-2.0-flash/)).toBeDefined();
  });

  it('calls onSend on Enter', () => {
    const onSend = vi.fn();
    render(<ChatView {...defaultProps} input="test" onSend={onSend} />);
    fireEvent.keyDown(screen.getByLabelText('Ask the AI agent'), { key: 'Enter' });
    expect(onSend).toHaveBeenCalled();
  });

  it('calls onClearChat when clear button clicked', () => {
    const onClearChat = vi.fn();
    render(<ChatView {...defaultProps} onClearChat={onClearChat} />);
    fireEvent.click(screen.getByLabelText('Clear chat history'));
    expect(onClearChat).toHaveBeenCalled();
  });

  it('shows loading indicator', () => {
    render(<ChatView {...defaultProps} isLoading={true} />);
    expect(screen.getByText('Thinking...')).toBeDefined();
  });

  it('shows sourcing indicator', () => {
    render(<ChatView {...defaultProps} isSourcing={true} />);
    expect(screen.getByText('Sourcing external data...')).toBeDefined();
  });

  it('renders source chips', () => {
    const sources = [{ url: 'https://example.com', title: 'Example', content: 'text', format: 'markdown' as const, wordCount: 1, provider: 'jina' as const }];
    render(<ChatView {...defaultProps} resolvedSources={sources} />);
    expect(screen.getByText('Example')).toBeDefined();
  });
});
