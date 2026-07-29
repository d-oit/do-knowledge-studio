import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '../dialog'

describe('Dialog', () => {
  it('renders trigger child when closed', () => {
    render(
      <Dialog>
        <DialogTrigger>Open dialog</DialogTrigger>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
          <DialogDescription>Body</DialogDescription>
        </DialogContent>
      </Dialog>,
    )
    expect(screen.getByText('Open dialog')).toBeDefined()
  })

  it('shows content and close button after opening', () => {
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Modal title</DialogTitle>
          <DialogDescription>Modal body</DialogDescription>
        </DialogContent>
      </Dialog>,
    )
    fireEvent.click(screen.getByText('Open'))
    expect(screen.getByText('Modal title')).toBeDefined()
    expect(screen.getByText('Modal body')).toBeDefined()
    // Close button exposes accessible name via sr-only "Close" span
    expect(screen.getByRole('button', { name: 'Close' })).toBeDefined()
  })

  it('hides the close button when showCloseButton is false', () => {
    render(
      <Dialog defaultOpen>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent showCloseButton={false}>
          <DialogTitle>No close</DialogTitle>
          <DialogDescription>Body</DialogDescription>
        </DialogContent>
      </Dialog>,
    )
    expect(screen.getByText('No close')).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
  })

  it('closes on Escape key', () => {
    render(
      <Dialog defaultOpen>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Esc test</DialogTitle>
          <DialogDescription>Press escape</DialogDescription>
        </DialogContent>
      </Dialog>,
    )
    expect(screen.getByText('Esc test')).toBeDefined()
    // Radix DismissableLayer listens on the dialog content element
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByText('Esc test')).toBeNull()
  })

  it('closes via DialogClose button', () => {
    render(
      <Dialog defaultOpen>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Close test</DialogTitle>
          <DialogDescription>Body</DialogDescription>
          <DialogClose asChild>
            <button type="button">Cancel</button>
          </DialogClose>
        </DialogContent>
      </Dialog>,
    )
    expect(screen.getByText('Close test')).toBeDefined()
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByText('Close test')).toBeNull()
  })

  it('DialogHeader sets data-slot and layout classes', () => {
    const { container } = render(<DialogHeader>Header area</DialogHeader>)
    const header = container.querySelector('[data-slot="dialog-header"]')
    expect(header).toBeDefined()
    expect(header?.className).toContain('flex')
    expect(header?.className).toContain('flex-col')
  })

  it('DialogFooter sets data-slot and layout classes', () => {
    const { container } = render(<DialogFooter>Footer area</DialogFooter>)
    const footer = container.querySelector('[data-slot="dialog-footer"]')
    expect(footer).toBeDefined()
    expect(footer?.className).toContain('flex')
  })

  it('DialogTitle renders with heading semantics and semibold class', () => {
    render(
      <Dialog defaultOpen>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Heading</DialogTitle>
          <DialogDescription>Body</DialogDescription>
        </DialogContent>
      </Dialog>,
    )
    const title = screen.getByText('Heading')
    expect(title.getAttribute('data-slot')).toBe('dialog-title')
    expect(title.className).toContain('font-semibold')
  })

  it('DialogDescription renders with muted-foreground class', () => {
    render(
      <Dialog defaultOpen>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
          <DialogDescription>Subtitle text</DialogDescription>
        </DialogContent>
      </Dialog>,
    )
    const desc = screen.getByText('Subtitle text')
    expect(desc.getAttribute('data-slot')).toBe('dialog-description')
    expect(desc.className).toContain('text-muted-foreground')
  })

  it('DialogContent accepts custom className', () => {
    render(
      <Dialog defaultOpen>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent className="my-dialog">
          <DialogTitle>Title</DialogTitle>
          <DialogDescription>Body</DialogDescription>
        </DialogContent>
      </Dialog>,
    )
    // Dialog content renders in a Portal on document.body
    const content = document.querySelector('[data-slot="dialog-content"]')
    expect(content).toBeDefined()
    expect(content?.className).toContain('my-dialog')
  })
})
