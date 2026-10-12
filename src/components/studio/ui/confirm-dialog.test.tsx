import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { ConfirmDialog } from './shared-primitives'

/** Harness that opens the dialog from a trigger, for focus-restoration assertions. */
const ConfirmDialogHarness = () => {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        onClick={() => {
          setOpen(true)
        }}
      >
        Delete entity
      </button>
      <ConfirmDialog
        open={open}
        onConfirm={() => {
          setOpen(false)
        }}
        onCancel={() => {
          setOpen(false)
        }}
        title="Delete entity?"
        body="This cannot be undone."
        confirmLabel="Delete"
        destructive
      />
    </div>
  )
}

describe('ConfirmDialog', () => {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  const defaultProps = {
    open: true,
    onConfirm,
    onCancel,
    title: 'Delete entity?',
    body: '"Widgets" will be permanently deleted. This cannot be undone.',
    confirmLabel: 'Delete',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing while closed', () => {
    render(<ConfirmDialog {...defaultProps} open={false} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders a labelled modal dialog with the title and body', () => {
    render(<ConfirmDialog {...defaultProps} />)
    const dialog = screen.getByRole('dialog', { name: 'Delete entity?' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(within(dialog).getByText(defaultProps.body)).toBeDefined()
  })

  it('names itself by the heading and describes itself by the body', () => {
    // A dialog labelled only with `aria-label` announced the question and never
    // the warning the user is confirming (review on #939). Both attributes must
    // resolve to the rendered elements.
    render(<ConfirmDialog {...defaultProps} />)

    const dialog = screen.getByRole('dialog')
    const labelledBy = dialog.getAttribute('aria-labelledby')
    const describedBy = dialog.getAttribute('aria-describedby')
    expect(labelledBy).not.toBeNull()
    expect(describedBy).not.toBeNull()
    expect(document.getElementById(labelledBy ?? '')?.textContent).toBe(defaultProps.title)
    expect(document.getElementById(describedBy ?? '')?.textContent).toBe(defaultProps.body)
  })

  it('runs the action from the confirming button only', () => {
    render(<ConfirmDialog {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('defaults the dismissing button to Cancel and calls onCancel', () => {
    render(<ConfirmDialog {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('honours a custom cancel label', () => {
    render(<ConfirmDialog {...defaultProps} cancelLabel="Keep editing" />)
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('cancels on Escape', () => {
    render(<ConfirmDialog {...defaultProps} />)
    fireEvent.keyDown(screen.getByRole('button', { name: 'Cancel' }), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('cancels on a backdrop click but ignores clicks inside the dialog', () => {
    render(<ConfirmDialog {...defaultProps} />)
    fireEvent.click(screen.getByRole('dialog'))
    expect(onCancel).not.toHaveBeenCalled()
    const backdrop = screen.getByRole('dialog').parentElement
    if (!backdrop) throw new Error('backdrop missing')
    fireEvent.click(backdrop)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('styles the confirming button as destructive when asked', () => {
    render(<ConfirmDialog {...defaultProps} destructive />)
    expect(screen.getByRole('button', { name: 'Delete' }).className).toContain('bg-red-600')
  })

  it('falls back to the primary styling for non-destructive confirmations', () => {
    render(<ConfirmDialog {...defaultProps} />)
    expect(screen.getByRole('button', { name: 'Delete' }).className).toContain('bg-primary')
  })

  it('moves focus into the dialog and returns it to the trigger on close', () => {
    render(<ConfirmDialogHarness />)
    const trigger = screen.getByRole('button', { name: 'Delete entity' })
    trigger.focus()
    fireEvent.click(trigger)

    const dialog = screen.getByRole('dialog', { name: 'Delete entity?' })
    const cancel = within(dialog).getByRole('button', { name: 'Cancel' })
    expect(document.activeElement).toBe(cancel)

    fireEvent.keyDown(cancel, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })
})
