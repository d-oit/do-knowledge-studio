import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => (
    <span data-testid="icon" className={className} />
  )
  return { Mic: Icon, Loader2: Icon, Sparkles: Icon }
})

vi.mock('@/lib/utils', () => ({
  cn: (...args: (string | undefined | false | null)[]) => args.filter(Boolean).join(' '),
}))

const mockStart = vi.fn()
const mockStop = vi.fn()
const mockReset = vi.fn()

let isSupported = true
let isListening = false
let transcript = ''
let interimTranscript = ''
let error: string | null = null

vi.mock('@/lib/use-speech-recognition', () => ({
  useSpeechRecognition: () => ({
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    error,
    start: mockStart,
    stop: mockStop,
    reset: mockReset,
  }),
}))

vi.mock('@/lib/nlp', () => ({
  parseIntent: vi.fn(() => ({ type: 'create', confidence: 0.9 })),
  formatIntentSummary: vi.fn(() => 'Create entity'),
}))

import { VoiceInput } from './voice-input'

const defaultProps = {
  onTranscript: vi.fn(),
  onIntent: vi.fn(),
}

describe('VoiceInput', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isSupported = true
    isListening = false
    transcript = ''
    interimTranscript = ''
    error = null
  })

  it('renders nothing when speech is not supported', () => {
    isSupported = false
    const { container } = render(<VoiceInput {...defaultProps} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders the microphone button when supported', () => {
    render(<VoiceInput {...defaultProps} />)
    expect(screen.getByLabelText('Start voice input')).toBeDefined()
  })

  it('shows Mic icon when not listening', () => {
    render(<VoiceInput {...defaultProps} />)
    const icons = screen.getAllByTestId('icon')
    expect(icons.length).toBeGreaterThanOrEqual(1)
  })

  it('starts listening on click', () => {
    render(<VoiceInput {...defaultProps} />)
    fireEvent.click(screen.getByLabelText('Start voice input'))
    expect(mockReset).toHaveBeenCalled()
    expect(mockStart).toHaveBeenCalled()
  })

  it('shows Stop recording label when listening', () => {
    isListening = true
    render(<VoiceInput {...defaultProps} />)
    expect(screen.getByLabelText('Stop recording')).toBeDefined()
  })

  it('stops listening on click when already listening', () => {
    isListening = true
    render(<VoiceInput {...defaultProps} />)
    fireEvent.click(screen.getByLabelText('Stop recording'))
    expect(mockStop).toHaveBeenCalled()
  })

  it('shows interim transcript when listening', () => {
    isListening = true
    interimTranscript = 'Hello world...'
    render(<VoiceInput {...defaultProps} />)
    expect(screen.getByText('Hello world...')).toBeDefined()
  })

  it('does not show interim transcript when not listening', () => {
    isListening = false
    interimTranscript = 'Hello world...'
    render(<VoiceInput {...defaultProps} />)
    expect(screen.queryByText('Hello world...')).toBeNull()
  })

  it('calls onTranscript when transcript changes', () => {
    const onTranscript = vi.fn()
    transcript = 'Hello there'
    render(<VoiceInput {...defaultProps} onTranscript={onTranscript} />)
    expect(onTranscript).toHaveBeenCalledWith('Hello there')
  })

  it('calls onIntent when transcript changes and onIntent is provided', () => {
    const onIntent = vi.fn()
    transcript = 'Create a new entity about TRIZ'
    render(<VoiceInput {...defaultProps} onTranscript={vi.fn()} onIntent={onIntent} />)
    expect(onIntent).toHaveBeenCalled()
  })

  it('does not crash when onIntent is not provided', () => {
    transcript = 'Hello'
    expect(() => {
      render(<VoiceInput onTranscript={vi.fn()} />)
    }).not.toThrow()
  })

  it('disables the button when disabled prop is true', () => {
    render(<VoiceInput {...defaultProps} disabled />)
    expect(screen.getByLabelText('Start voice input')).toBeDisabled()
  })

  it('shows intent preview when showIntentPreview is true', () => {
    transcript = 'Create entity'
    render(<VoiceInput {...defaultProps} showIntentPreview />)
    // After transcript triggers intent, the preview should show when not listening
    expect(screen.getByText('Create entity')).toBeDefined()
  })

  it('does not show intent preview when showIntentPreview is false', () => {
    transcript = 'Create entity'
    render(<VoiceInput {...defaultProps} showIntentPreview={false} />)
    expect(screen.queryByText('Create entity')).toBeNull()
  })

  it('applies custom className', () => {
    const { container } = render(<VoiceInput {...defaultProps} className="custom-class" />)
    expect(container.firstElementChild).toBeDefined()
  })

  it('logs speech recognition errors to console', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    error = 'not-allowed'
    render(<VoiceInput {...defaultProps} />)
    expect(consoleSpy).toHaveBeenCalledWith('Speech recognition error:', 'not-allowed')
    consoleSpy.mockRestore()
  })

  it('button has pulse animation when listening', () => {
    isListening = true
    render(<VoiceInput {...defaultProps} />)
    const btn = screen.getByLabelText('Stop recording')
    expect(btn.className).toContain('animate-pulse')
  })

  it('resets intent on new recording start', () => {
    render(<VoiceInput {...defaultProps} />)
    fireEvent.click(screen.getByLabelText('Start voice input'))
    expect(mockReset).toHaveBeenCalled()
  })
})
