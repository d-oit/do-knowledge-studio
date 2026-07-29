import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RadioGroup, RadioGroupItem } from '../radio-group'

describe('RadioGroup', () => {
  it('renders a radiogroup with items', () => {
    render(
      <RadioGroup defaultValue="a">
        <RadioGroupItem value="a" id="r-a" />
        <RadioGroupItem value="b" id="r-b" />
      </RadioGroup>,
    )
    const group = screen.getByRole('radiogroup')
    expect(group).toBeDefined()
    expect(group.getAttribute('data-slot')).toBe('radio-group')
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(2)
  })

  it('applies grid layout classes', () => {
    render(
      <RadioGroup>
        <RadioGroupItem value="x" id="r-x" />
      </RadioGroup>,
    )
    const group = screen.getByRole('radiogroup')
    expect(group.className).toContain('grid')
    expect(group.className).toContain('gap-3')
  })

  it('checks the default selected item', () => {
    render(
      <RadioGroup defaultValue="b">
        <RadioGroupItem value="a" id="r-a" aria-label="Option A" />
        <RadioGroupItem value="b" id="r-b" aria-label="Option B" />
      </RadioGroup>,
    )
    const radioB = screen.getByRole('radio', { name: 'Option B' })
    expect(radioB.getAttribute('data-state')).toBe('checked')
    const radioA = screen.getByRole('radio', { name: 'Option A' })
    expect(radioA.getAttribute('data-state')).toBe('unchecked')
  })

  it('RadioGroupItem sets data-slot and shape classes', () => {
    render(
      <RadioGroup>
        <RadioGroupItem value="v" id="r-v" aria-label="Styled" />
      </RadioGroup>,
    )
    const radio = screen.getByRole('radio', { name: 'Styled' })
    expect(radio.getAttribute('data-slot')).toBe('radio-group-item')
    expect(radio.className).toContain('rounded-full')
    expect(radio.className).toContain('border')
  })

  it('renders disabled RadioGroupItem', () => {
    render(
      <RadioGroup>
        <RadioGroupItem value="d" id="r-d" disabled aria-label="Disabled" />
      </RadioGroup>,
    )
    const radio = screen.getByRole('radio', { name: 'Disabled' })
    expect(radio).toBeDisabled()
    expect(radio.className).toContain('disabled:opacity-50')
  })

  it('selects an item on click', () => {
    render(
      <RadioGroup>
        <RadioGroupItem value="a" id="r-click-a" aria-label="Click A" />
        <RadioGroupItem value="b" id="r-click-b" aria-label="Click B" />
      </RadioGroup>,
    )
    const radioA = screen.getByRole('radio', { name: 'Click A' })
    expect(radioA.getAttribute('data-state')).toBe('unchecked')
    fireEvent.click(radioA)
    expect(radioA.getAttribute('data-state')).toBe('checked')
  })

  it('accepts custom className on RadioGroup', () => {
    render(
      <RadioGroup className="my-group">
        <RadioGroupItem value="v" id="r-custom" aria-label="Item" />
      </RadioGroup>,
    )
    const group = screen.getByRole('radiogroup')
    expect(group.className).toContain('my-group')
  })
})
