import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ParamPicker, ContradictionChip } from './triz-helpers'

const baseProps = {
  title: 'Improving Feature',
  subtitle: 'Choose a feature to improve',
  accent: 'saffron' as const,
  selected: null,
  onSelect: vi.fn(),
  search: '',
  setSearch: vi.fn(),
  filtered: [
    { label: 'Weight', index: 0 },
    { label: 'Length', index: 1 },
  ],
  disabled: [1],
}

describe('ParamPicker', () => {
  it('renders title, subtitle, and search input', () => {
    render(<ParamPicker {...baseProps} />)
    expect(screen.getByText('Improving Feature')).toBeInTheDocument()
    expect(screen.getByText('Choose a feature to improve')).toBeInTheDocument()
    expect(screen.getByLabelText('Search TRIZ parameters')).toBeInTheDocument()
  })

  it('renders filtered parameter options as buttons', () => {
    render(<ParamPicker {...baseProps} />)
    expect(screen.getByRole('button', { name: /Weight/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Length/ })).toBeInTheDocument()
  })

  it('selects an option', () => {
    const onSelect = vi.fn()
    render(<ParamPicker {...baseProps} onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: /Weight/ }))
    expect(onSelect).toHaveBeenCalledWith(0)
  })

  it('disables disabled options', () => {
    render(<ParamPicker {...baseProps} />)
    const lengthButton = screen.getByRole('button', { name: /Length/ })
    expect(lengthButton).toBeDisabled()
  })

  it('shows a check mark on the selected option', () => {
    render(<ParamPicker {...baseProps} selected={0} />)
    const weightButton = screen.getByRole('button', { name: /Weight/ })
    expect(weightButton.querySelector('svg')).not.toBeNull()
  })

  it('calls setSearch when typing', () => {
    const setSearch = vi.fn()
    render(<ParamPicker {...baseProps} setSearch={setSearch} />)
    fireEvent.change(screen.getByLabelText('Search TRIZ parameters'), { target: { value: 'weight' } })
    expect(setSearch).toHaveBeenCalledWith('weight')
  })

  it('renders empty state when no filtered options', () => {
    render(<ParamPicker {...baseProps} filtered={[]} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('ContradictionChip', () => {
  it('renders number and label', () => {
    render(<ContradictionChip n={1} label="Weight" accent="saffron" />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('Weight')).toBeInTheDocument()
  })

  it('renders clay accent variant', () => {
    render(<ContradictionChip n={2} label="Speed" accent="clay" />)
    expect(screen.getByText('Speed')).toBeInTheDocument()
  })
})