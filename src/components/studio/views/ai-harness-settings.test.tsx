import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Database } from 'lucide-react'
import { Field, PROVIDERS } from './ai-harness-settings'

describe('PROVIDERS', () => {
  it('exports an array of provider options', () => {
    expect(PROVIDERS).toBeDefined()
    expect(Array.isArray(PROVIDERS)).toBe(true)
    expect(PROVIDERS.length).toBeGreaterThanOrEqual(2)
  })

  it('includes openrouter provider', () => {
    const openrouter = PROVIDERS.find((p) => p.id === 'openrouter')
    expect(openrouter).toBeDefined()
    expect(openrouter?.requiresKey).toBe(true)
    expect(openrouter?.label).toBeDefined()
  })

  it('includes ollama provider', () => {
    const ollama = PROVIDERS.find((p) => p.id === 'ollama')
    expect(ollama).toBeDefined()
    expect(ollama?.requiresKey).toBe(false)
  })

  it('each provider has required fields', () => {
    for (const provider of PROVIDERS) {
      expect(provider.id).toBeDefined()
      expect(provider.label).toBeDefined()
      expect(Array.isArray(provider.models)).toBe(true)
      expect(typeof provider.requiresKey).toBe('boolean')
    }
  })
})

describe('Field', () => {
  it('renders label text', () => {
    render(
      <Field label="Test Field" icon={Database}>
        <input type="text" />
      </Field>,
    )
    expect(screen.getByText('Test Field')).toBeDefined()
  })

  it('renders children', () => {
    render(
      <Field label="Test Field" icon={Database}>
        <input type="text" placeholder="Enter value" />
      </Field>,
    )
    expect(screen.getByPlaceholderText('Enter value')).toBeDefined()
  })

  it('generates an id from the label for htmlFor association', () => {
    render(
      <Field label="API Key" icon={Database}>
        <input type="text" />
      </Field>,
    )
    const label = screen.getByText('API Key')
    expect(label.closest('label')).toHaveAttribute('for', 'field-api-key')
  })

  it('injects id into input children', () => {
    render(
      <Field label="My Field" icon={Database}>
        <input type="text" data-testid="injected" />
      </Field>,
    )
    const input = screen.getByTestId('injected')
    expect(input).toHaveAttribute('id', 'field-my-field')
  })

  it('injects id into select children', () => {
    render(
      <Field label="Provider" icon={Database}>
        <select data-testid="select">
          <option value="a">A</option>
        </select>
      </Field>,
    )
    const select = screen.getByTestId('select')
    expect(select).toHaveAttribute('id', 'field-provider')
  })

  it('does not inject id into non-form elements', () => {
    render(
      <Field label="Status" icon={Database}>
        <div data-testid="div">Content</div>
      </Field>,
    )
    const div = screen.getByTestId('div')
    expect(div).not.toHaveAttribute('id')
  })
})
