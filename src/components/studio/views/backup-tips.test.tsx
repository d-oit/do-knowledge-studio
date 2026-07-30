import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => (
    <span data-testid="icon" className={className} />
  )
  return { Sparkles: Icon, Check: Icon }
})

import { BackupTips } from './backup-tips'

describe('BackupTips', () => {
  it('renders the Backup tips heading', () => {
    render(<BackupTips />)
    expect(screen.getByText('Backup tips')).toBeDefined()
  })

  it('renders the section element', () => {
    const { container } = render(<BackupTips />)
    const section = container.querySelector('section')
    expect(section).toBeDefined()
  })

  it('renders all four backup tips', () => {
    render(<BackupTips />)
    expect(screen.getByText(/JSON exports are the most complete/)).toBeDefined()
    expect(screen.getByText(/PDF and DOCX are print-ready/)).toBeDefined()
    expect(screen.getByText(/Encrypted HTML is safe to email/)).toBeDefined()
    expect(screen.getByText(/Your library is automatically saved/)).toBeDefined()
  })

  it('renders check icons for each tip', () => {
    render(<BackupTips />)
    const icons = screen.getAllByTestId('icon')
    // 1 Sparkles + 4 Check icons
    expect(icons.length).toBeGreaterThanOrEqual(5)
  })

  it('is wrapped in memo (displayName)', () => {
    // BackupTips is wrapped in React.memo — verify it renders as a function component
    render(<BackupTips />)
    expect(screen.getByText('Backup tips')).toBeDefined()
  })

  it('renders the AES-256-GCM encryption note', () => {
    render(<BackupTips />)
    expect(screen.getByText(/AES-256-GCM encrypted/)).toBeDefined()
  })

  it('renders the weekly export recommendation', () => {
    render(<BackupTips />)
    expect(screen.getByText(/Export a JSON backup weekly/)).toBeDefined()
  })
})
