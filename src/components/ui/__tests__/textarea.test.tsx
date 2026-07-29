import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Textarea } from '../textarea'

describe('Textarea', () => {
  it('renders a textarea element with placeholder', () => {
    render(<Textarea placeholder="Enter your message" />)
    const textarea = screen.getByPlaceholderText('Enter your message')
    expect(textarea).toBeDefined()
    expect(textarea.tagName).toBe('TEXTAREA')
    expect(textarea.getAttribute('data-slot')).toBe('textarea')
  })

  it('applies default border and size classes', () => {
    render(<Textarea aria-label="styled-ta" />)
    const textarea = screen.getByLabelText('styled-ta')
    expect(textarea.className).toContain('rounded-md')
    expect(textarea.className).toContain('border')
    expect(textarea.className).toContain('min-h-16')
    expect(textarea.className).toContain('w-full')
  })

  it('applies focus-visible ring classes', () => {
    render(<Textarea aria-label="ring-ta" />)
    const textarea = screen.getByLabelText('ring-ta')
    expect(textarea.className).toContain('focus-visible:ring')
  })

  it('renders in disabled state', () => {
    render(<Textarea disabled aria-label="disabled-ta" />)
    const textarea = screen.getByLabelText('disabled-ta')
    expect(textarea).toBeDisabled()
    expect(textarea.className).toContain('disabled:cursor-not-allowed')
    expect(textarea.className).toContain('disabled:opacity-50')
  })

  it('accepts custom className', () => {
    render(<Textarea className="my-textarea" aria-label="custom-ta" />)
    const textarea = screen.getByLabelText('custom-ta')
    expect(textarea.className).toContain('my-textarea')
  })

  it('supports rows attribute', () => {
    render(<Textarea rows={5} aria-label="rows-ta" />)
    const textarea = screen.getByLabelText('rows-ta')
    expect(textarea.getAttribute('rows')).toBe('5')
  })

  it('supports defaultValue', () => {
    render(<Textarea defaultValue="Pre-filled" aria-label="default-ta" />)
    const textarea = screen.getByLabelText('default-ta') as HTMLTextAreaElement
    expect(textarea.value).toBe('Pre-filled')
  })

  it('calls onChange handler', () => {
    let changed = false
    render(<Textarea aria-label="onchange-ta" onChange={() => { changed = true }} />)
    fireEvent.change(screen.getByLabelText('onchange-ta'), { target: { value: 'text' } })
    expect(changed).toBe(true)
  })

  it('passes through aria-describedby', () => {
    render(<Textarea aria-label="described-ta" aria-describedby="ta-help" />)
    const textarea = screen.getByLabelText('described-ta')
    expect(textarea.getAttribute('aria-describedby')).toBe('ta-help')
  })
})
