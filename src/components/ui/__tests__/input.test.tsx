import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Input } from '../input'

describe('Input', () => {
  it('renders a text input by default', () => {
    render(<Input placeholder="Type here" />)
    const input = screen.getByPlaceholderText('Type here')
    expect(input).toBeDefined()
    expect(input.tagName).toBe('INPUT')
    expect(input.getAttribute('data-slot')).toBe('input')
  })

  it('renders default base classes', () => {
    render(<Input aria-label="field" />)
    const input = screen.getByLabelText('field')
    expect(input.className).toContain('h-9')
    expect(input.className).toContain('rounded-md')
    expect(input.className).toContain('border')
    expect(input.className).toContain('px-3')
  })

  it('applies focus-visible ring classes', () => {
    render(<Input aria-label="ring-test" />)
    const input = screen.getByLabelText('ring-test')
    expect(input.className).toContain('focus-visible:ring')
  })

  it('supports type="email"', () => {
    render(<Input type="email" aria-label="email" />)
    const input = screen.getByLabelText('email')
    expect(input.getAttribute('type')).toBe('email')
  })

  it('supports type="password"', () => {
    render(<Input type="password" aria-label="password" defaultValue="secret" />)
    const input = screen.getByLabelText('password') as HTMLInputElement
    expect(input.getAttribute('type')).toBe('password')
    expect(input.value).toBe('secret')
  })

  it('renders in disabled state', () => {
    render(<Input disabled aria-label="disabled-field" />)
    const input = screen.getByLabelText('disabled-field')
    expect(input).toBeDisabled()
    expect(input.className).toContain('disabled:cursor-not-allowed')
    expect(input.className).toContain('disabled:opacity-50')
  })

  it('accepts custom className', () => {
    render(<Input className="my-input" aria-label="custom" />)
    const input = screen.getByLabelText('custom')
    expect(input.className).toContain('my-input')
  })

  it('calls onChange handler', () => {
    let changed = false
    render(<Input aria-label="onchange" onChange={() => { changed = true }} />)
    fireEvent.change(screen.getByLabelText('onchange'), { target: { value: 'hi' } })
    expect(changed).toBe(true)
  })

  it('passes through aria-describedby', () => {
    render(<Input aria-label="described" aria-describedby="help-text" />)
    const input = screen.getByLabelText('described')
    expect(input.getAttribute('aria-describedby')).toBe('help-text')
  })

  it('passes through aria-invalid styling hook', () => {
    render(<Input aria-label="invalid" aria-invalid="true" />)
    const input = screen.getByLabelText('invalid')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.className).toContain('aria-invalid:border-destructive')
  })
})
