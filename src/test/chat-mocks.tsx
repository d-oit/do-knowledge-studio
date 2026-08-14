import { vi, type Mock } from 'vitest'
import type { ReactNode } from 'react'

/**
 * Shared vi.mock factories for the chat views (chat-view.test.tsx,
 * chat-view-coverage.test.tsx, chat-parts.test.tsx). Each test file wires
 * them via `vi.mock('<module>', async () => (await import('@/test/chat-mocks')).x)`.
 * Kept here so the mock contract changes in one place (OwlWatch: duplicate
 * mock setup in tests).
 */

const Icon = ({ className }: { className?: string }) => (
  <span data-testid="icon" className={className} />
)

/** framer-motion mock: renders plain DOM so jsdom tests see no animations. */
export const framerMotionMock = {
  motion: {
    div: ({ children, initial: _i, animate: _a, transition: _t, ...props }: { children?: ReactNode; [key: string]: unknown }) => (
      <div {...(props as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => children,
}

/** lucide-react mock: every icon renders as a lightweight span. */
export const lucideIconsMock = {
  Send: Icon,
  Sparkles: Icon,
  Trash2: Icon,
  Bot: Icon,
  User: Icon,
  Quote: Icon,
  ChevronDown: Icon,
  MessageSquare: Icon,
}

/** sonner mock: no-op toasts. Explicit `Mock` annotation avoids the
 * vitest `Procedure` type-portability error (TS2883) when the factory is
 * exported from a shared module. */
export const sonnerMock: { toast: { success: Mock; error: Mock; info: Mock } } = {
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}

/** react-markdown mock: renders children inside a marker div. */
export const markdownMock = {
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}

/** @/lib/utils mock: joins truthy args with spaces. */
export const cnMock = {
  cn: (...args: (string | undefined | false | null)[]) => args.filter(Boolean).join(' '),
}

/** use-reduced-motion mock: animations always on in tests. */
export const reducedMotionMock = {
  useReducedMotion: () => false,
}

/** VoiceInput mock: a marker div that forwards the disabled state. */
export const voiceInputMock = {
  VoiceInput: ({ onTranscript: _t, disabled }: { onTranscript?: (t: string) => void; disabled?: boolean }) => (
    <div data-testid="voice-input" data-disabled={String(Boolean(disabled))} />
  ),
}
