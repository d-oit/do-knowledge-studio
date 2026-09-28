import React, { type ReactNode } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MessageList } from './chat-subcomponents'
import type { ChatMessage, Entity } from '@/lib/studio/types'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, initial: _i, animate: _a, transition: _t, ...props }: { children?: ReactNode; [key: string]: unknown }) => (
      <div {...(props as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => children,
}))

vi.mock('lucide-react', () => {
  const Icon = (props: Record<string, unknown>) => React.createElement('span', { 'data-testid': 'icon', ...props })
  return {
    __esModule: true,
    Send: Icon,
    Sparkles: Icon,
    Trash2: Icon,
    Bot: Icon,
    User: Icon,
    Quote: Icon,
    ChevronDown: Icon,
    MessageSquare: Icon,
    ExternalLink: Icon,
    Tag: Icon,
    Save: Icon,
    X: Icon,
    Plus: Icon,
    AtSign: Icon,
    Bold: Icon,
    Italic: Icon,
    Heading1: Icon,
    Heading2: Icon,
    List: Icon,
    ListOrdered: Icon,
    Code: Icon,
    Link2: Icon,
    Mic: Icon,
  }
})

vi.mock('@/lib/utils', () => ({
  cn: (...args: (string | undefined | false | null)[]) => args.filter(Boolean).join(' '),
}))

vi.mock('../voice-input', () => ({
  VoiceInput: () => <div data-testid="voice-input" />,
}))

vi.mock('../remote-cursors', () => ({
  CursorTracker: ({ children }: { children?: ReactNode }) => children,
}))

vi.mock('./editor-toolbar', () => ({
  EditorToolbar: () => <div data-testid="editor-toolbar" />,
}))

vi.mock('./editor-claims-panel', () => ({
  ClaimsPanel: () => <div data-testid="claims-panel" />,
}))

vi.mock('./type-selector', () => ({
  TypeSelector: () => <div data-testid="type-selector" />,
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

let currentEditingEntity: Entity | null = null

vi.mock('@/lib/studio/store', () => ({
  useStudioStore: (selector: (s: Record<string, unknown>) => unknown) => {
    return selector({
      entities: currentEditingEntity ? [currentEditingEntity] : [],
      editingEntityId: currentEditingEntity?.id ?? null,
      commitEntities: vi.fn(),
      saveEntity: vi.fn(),
      finishEditing: vi.fn(),
      navigateToView: vi.fn(),
      claims: [],
      addClaim: vi.fn(),
      updateClaim: vi.fn(),
      deleteClaim: vi.fn(),
    })
  },
}))

import { EditorView } from './editor-view'

const assistantMsg = (content: string): ChatMessage => ({
  id: 'msg-1',
  role: 'assistant',
  content,
  timestamp: '2026-08-14T00:00:00.000Z',
})

describe('Chat MessageList Markdown Link Security', () => {
  const baseProps = {
    reducedMotion: false,
    showCitations: null,
    onToggleCitations: vi.fn(),
    onCitationClick: vi.fn(),
  }

  it('renders safe HTTP and HTTPS links with target="_blank" and rel="noopener noreferrer"', () => {
    const chat = [assistantMsg('[Open Example](https://example.com)')]
    render(<MessageList chat={chat} {...baseProps} />)

    const link = screen.getByRole('link', { name: 'Open Example' })
    expect(link).toHaveAttribute('href', 'https://example.com')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('sanitizes dangerous javascript: links into plain non-clickable text', () => {
    const chat = [assistantMsg('[Click Me](javascript:alert(1))')]
    render(<MessageList chat={chat} {...baseProps} />)

    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('Click Me')).toBeDefined()
  })

  it('sanitizes dangerous data: URIs into plain non-clickable text', () => {
    const chat = [assistantMsg('[Malicious Data](data:text/html,<script>alert(1)</script>)')]
    render(<MessageList chat={chat} {...baseProps} />)

    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('Malicious Data')).toBeDefined()
  })

  it('sanitizes protocol-relative links (//evil.com) into plain non-clickable text', () => {
    const chat = [assistantMsg('[Protocol Relative](//evil.com/phish)')]
    render(<MessageList chat={chat} {...baseProps} />)

    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('Protocol Relative')).toBeDefined()
  })

  it('renders safe image URLs and strips dangerous image sources', () => {
    const chat = [
      assistantMsg('![Safe Image](https://example.com/photo.png) ![Unsafe Image](javascript:alert(1))'),
    ]
    const { container } = render(<MessageList chat={chat} {...baseProps} />)

    const imgs = container.querySelectorAll('img')
    expect(imgs).toHaveLength(1)
    expect(imgs[0]).toHaveAttribute('src', 'https://example.com/photo.png')
    expect(imgs[0]).toHaveAttribute('alt', 'Safe Image')
  })
})

describe('EditorView Preview Markdown Link Security', () => {
  it('renders external markdown links with target="_blank" and rel="noopener noreferrer"', () => {
    currentEditingEntity = {
      id: 'ent-sec-1',
      name: 'Alice',
      type: 'person',
      description: 'A person',
      content: '[External Link](https://example.com/doc)',
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      links: [],
    }
    render(<EditorView />)

    const previewBtn = screen.getByRole('radio', { name: 'Preview' })
    fireEvent.click(previewBtn)

    const link = screen.getByRole('link', { name: 'External Link' })
    expect(link).toHaveAttribute('href', 'https://example.com/doc')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('sanitizes dangerous links in editor preview to non-clickable text', () => {
    currentEditingEntity = {
      id: 'ent-sec-2',
      name: 'Bob',
      type: 'concept',
      description: 'A concept',
      content: '[Exploit](javascript:alert(document.cookie))',
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      links: [],
    }
    render(<EditorView />)

    const previewBtn = screen.getByRole('radio', { name: 'Preview' })
    fireEvent.click(previewBtn)

    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('Exploit')).toBeDefined()
  })
})
