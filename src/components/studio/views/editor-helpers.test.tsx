import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EditorHeader, EditorTags } from './editor-helpers'

vi.mock('./type-selector', () => ({
  TypeSelector: ({ type, showMenu, onToggleMenu, onSelect }: {
    type: string
    showMenu: boolean
    onToggleMenu: () => void
    onSelect: (type: string) => void
  }) => (
    <div>
      <span data-testid="type-selector-value">{type}</span>
      {showMenu && <button data-testid="type-option" onClick={() => onSelect('project')}>project</button>}
      <button data-testid="toggle-type-menu" onClick={onToggleMenu}>toggle</button>
    </div>
  ),
}))

describe('EditorHeader', () => {
  it('renders type badge and name input', () => {
    render(
      <EditorHeader
        editing={null}
        name="My Entity"
        onNameChange={vi.fn()}
        type="note"
        description="A description"
        onDescriptionChange={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('Entity name')).toHaveValue('My Entity')
    expect(screen.getByLabelText('Description')).toHaveValue('A description')
  })

  it('renders edited date when editing is set', () => {
    render(
      <EditorHeader
        editing={{ updatedAt: '2026-08-01T00:00:00.000Z' }}
        name="My Entity"
        onNameChange={vi.fn()}
        type="note"
        description=""
        onDescriptionChange={vi.fn()}
      />,
    )
    expect(screen.getByText(/^Edited /)).toHaveTextContent('Edited Aug 1')
  })

  it('omits edited date when editing is null', () => {
    render(
      <EditorHeader
        editing={null}
        name="My Entity"
        onNameChange={vi.fn()}
        type="note"
        description=""
        onDescriptionChange={vi.fn()}
      />,
    )
    expect(screen.queryByText(/^Edited /)).not.toBeInTheDocument()
  })

  it('calls onNameChange when typing', () => {
    const onNameChange = vi.fn()
    render(
      <EditorHeader
        editing={null}
        name=""
        onNameChange={onNameChange}
        type="note"
        description=""
        onDescriptionChange={vi.fn()}
      />,
    )
    fireEvent.change(screen.getByLabelText('Entity name'), { target: { value: 'New name' } })
    expect(onNameChange).toHaveBeenCalledWith('New name')
  })
})

describe('EditorTags', () => {
  const baseProps = {
    tags: ['saffron', 'sky'],
    onTagsChange: vi.fn(),
    type: 'note' as const,
    showTypeMenu: false,
    onToggleTypeMenu: vi.fn(),
    onSelectType: vi.fn(),
  }

  it('renders existing tags', () => {
    render(<EditorTags {...baseProps} />)
    expect(screen.getByText('#saffron')).toBeInTheDocument()
    expect(screen.getByText('#sky')).toBeInTheDocument()
  })

  it('adds a tag on Enter press', () => {
    const onTagsChange = vi.fn()
    render(<EditorTags {...baseProps} onTagsChange={onTagsChange} />)
    const input = screen.getByPlaceholderText('add tag')
    fireEvent.change(input, { target: { value: 'sage' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onTagsChange).toHaveBeenCalledWith(['saffron', 'sky', 'sage'])
  })

  it('strips leading # from new tag', () => {
    const onTagsChange = vi.fn()
    render(<EditorTags {...baseProps} onTagsChange={onTagsChange} />)
    const input = screen.getByPlaceholderText('add tag')
    fireEvent.change(input, { target: { value: '#clay' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onTagsChange).toHaveBeenCalledWith(['saffron', 'sky', 'clay'])
  })

  it('trims whitespace from new tag', () => {
    const onTagsChange = vi.fn()
    render(<EditorTags {...baseProps} onTagsChange={onTagsChange} />)
    const input = screen.getByPlaceholderText('add tag')
    fireEvent.change(input, { target: { value: '  sage  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onTagsChange).toHaveBeenCalledWith(['saffron', 'sky', 'sage'])
  })

  it('does not add duplicate tags', () => {
    const onTagsChange = vi.fn()
    render(<EditorTags {...baseProps} onTagsChange={onTagsChange} />)
    const input = screen.getByPlaceholderText('add tag')
    fireEvent.change(input, { target: { value: 'saffron' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onTagsChange).not.toHaveBeenCalled()
  })

  it('adds tag via the plus button', () => {
    const onTagsChange = vi.fn()
    render(<EditorTags {...baseProps} onTagsChange={onTagsChange} />)
    const input = screen.getByPlaceholderText('add tag')
    fireEvent.change(input, { target: { value: 'sage' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add tag' }))
    expect(onTagsChange).toHaveBeenCalledWith(['saffron', 'sky', 'sage'])
  })

  it('removes a tag', () => {
    const onTagsChange = vi.fn()
    render(<EditorTags {...baseProps} onTagsChange={onTagsChange} />)
    fireEvent.click(screen.getByLabelText('Remove tag saffron'))
    expect(onTagsChange).toHaveBeenCalledWith(['sky'])
  })

  it('toggles the type menu', () => {
    const onToggleTypeMenu = vi.fn()
    render(<EditorTags {...baseProps} onToggleTypeMenu={onToggleTypeMenu} />)
    fireEvent.click(screen.getByTestId('toggle-type-menu'))
    expect(onToggleTypeMenu).toHaveBeenCalled()
  })

  it('selects a type from the menu', () => {
    const onSelectType = vi.fn()
    render(<EditorTags {...baseProps} showTypeMenu onSelectType={onSelectType} />)
    fireEvent.click(screen.getByTestId('type-option'))
    expect(onSelectType).toHaveBeenCalledWith('project')
  })
})