import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => (
    <span data-testid="icon" className={className} />
  )
  return { Mic: Icon, Check: Icon, X: Icon, Loader2: Icon }
})

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: (string | undefined | false | null)[]) => args.filter(Boolean).join(' '),
}))

vi.mock('@/lib/nlp', () => ({
  parseIntent: vi.fn(() => ({
    type: 'create_entity',
    name: 'TRIZ Methodology',
    description: 'Problem-solving framework',
    entityType: 'concept',
    tags: ['triz'],
    confidence: 0.9,
  })),
  formatIntentSummary: vi.fn(() => 'Create entity: TRIZ Methodology'),
}))

vi.mock('@/lib/studio/types', () => ({}))

const mockSaveEntity = vi.fn()

vi.mock('@/lib/studio/store', () => ({
  useStudioStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ saveEntity: mockSaveEntity }),
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

import { VoiceCapture } from './voice-capture'

describe('VoiceCapture', () => {
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
    const { container } = render(<VoiceCapture />)
    expect(container.innerHTML).toBe('')
  })

  it('renders the mic button when supported', () => {
    render(<VoiceCapture />)
    expect(screen.getByLabelText('Start voice capture')).toBeDefined()
  })

  it('starts listening on click', () => {
    render(<VoiceCapture />)
    fireEvent.click(screen.getByLabelText('Start voice capture'))
    expect(mockReset).toHaveBeenCalled()
    expect(mockStart).toHaveBeenCalled()
  })

  it('shows Recording label when listening', () => {
    isListening = true
    render(<VoiceCapture />)
    expect(screen.getByLabelText('Recording...')).toBeDefined()
  })

  it('shows interim transcript when listening', () => {
    isListening = true
    interimTranscript = 'Create a new entity...'
    render(<VoiceCapture />)
    expect(screen.getByText('Create a new entity...')).toBeDefined()
  })

  it('shows intent preview when pending intent exists', () => {
    transcript = 'Create TRIZ methodology'
    render(<VoiceCapture />)
    expect(screen.getByText('Create entity: TRIZ Methodology')).toBeDefined()
  })

  it('shows entity name input when create_entity intent', () => {
    transcript = 'Create TRIZ methodology'
    render(<VoiceCapture />)
    expect(screen.getByPlaceholderText('Entity name')).toBeDefined()
  })

  it('shows description textarea when create_entity intent', () => {
    transcript = 'Create TRIZ methodology'
    render(<VoiceCapture />)
    expect(screen.getByPlaceholderText('Description (optional)')).toBeDefined()
  })

  it('shows Confirm and Dismiss buttons when intent pending', () => {
    transcript = 'Create TRIZ methodology'
    render(<VoiceCapture />)
    expect(screen.getByText('Confirm')).toBeDefined()
    expect(screen.getByText('Dismiss')).toBeDefined()
  })

  it('calls saveEntity on Confirm with correct entity data', () => {
    transcript = 'Create TRIZ methodology'
    render(<VoiceCapture />)
    fireEvent.click(screen.getByText('Confirm'))
    expect(mockSaveEntity).toHaveBeenCalledWith(expect.objectContaining({
      name: 'TRIZ Methodology',
      type: 'concept',
      tags: ['triz'],
    }))
  })

  it('calls onEntityCreated callback on Confirm', () => {
    const onEntityCreated = vi.fn()
    transcript = 'Create TRIZ methodology'
    render(<VoiceCapture onEntityCreated={onEntityCreated} />)
    fireEvent.click(screen.getByText('Confirm'))
    expect(onEntityCreated).toHaveBeenCalled()
  })

  it('resets state on Dismiss', () => {
    transcript = 'Create TRIZ methodology'
    render(<VoiceCapture />)
    fireEvent.click(screen.getByText('Dismiss'))
    expect(mockReset).toHaveBeenCalled()
    // Intent preview should disappear
    expect(screen.queryByText('Create entity: TRIZ Methodology')).toBeNull()
  })

  it('shows error message when error exists', () => {
    error = 'not-allowed'
    render(<VoiceCapture />)
    expect(screen.getByText('not-allowed')).toBeDefined()
  })

  it('does not show error when no error', () => {
    error = null
    render(<VoiceCapture />)
    expect(screen.queryByText('not-allowed')).toBeNull()
  })

  it('applies custom className', () => {
    const { container } = render(<VoiceCapture className="custom" />)
    expect(container.firstElementChild?.className).toContain('custom')
  })

  it('button has pulse animation when listening', () => {
    isListening = true
    render(<VoiceCapture />)
    const btn = screen.getByLabelText('Recording...')
    expect(btn.className).toContain('animate-pulse')
  })

  it('button is disabled when listening', () => {
    isListening = true
    render(<VoiceCapture />)
    expect(screen.getByLabelText('Recording...')).toBeDisabled()
  })

  it('allows editing entity name before confirm', () => {
    transcript = 'Create TRIZ methodology'
    render(<VoiceCapture />)
    const nameInput = screen.getByPlaceholderText('Entity name')
    fireEvent.change(nameInput, { target: { value: 'Custom Name' } })
    expect(nameInput).toHaveValue('Custom Name')
  })

  it('allows editing description before confirm', () => {
    transcript = 'Create TRIZ methodology'
    render(<VoiceCapture />)
    const descInput = screen.getByPlaceholderText('Description (optional)')
    fireEvent.change(descInput, { target: { value: 'Custom description' } })
    expect(descInput).toHaveValue('Custom description')
  })
})
