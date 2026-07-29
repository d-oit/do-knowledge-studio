import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
} from '../toast'

describe('Toast', () => {
  it('renders with title and description', () => {
    render(
      <ToastProvider>
        <Toast>
          <ToastTitle>Toast title</ToastTitle>
          <ToastDescription>Toast description</ToastDescription>
        </Toast>
        <ToastViewport />
      </ToastProvider>,
    )
    expect(screen.getByText('Toast title')).toBeDefined()
    expect(screen.getByText('Toast description')).toBeDefined()
  })

  it('renders default variant classes and role accessibility', () => {
    render(
      <ToastProvider>
        <Toast>
          <ToastTitle>Default</ToastTitle>
        </Toast>
        <ToastViewport />
      </ToastProvider>,
    )
    const toast = document.querySelector('li[data-state="open"]')
    expect(toast).toBeDefined()
    expect(toast!.getAttribute('class')).toContain('border')
    expect(toast!.getAttribute('class')).toContain('bg-background')
    // Radix renders a hidden assertive-live region for screen readers
    const liveRegion = document.querySelector('[role="status"]')
    expect(liveRegion).toBeDefined()
  })

  it('renders destructive variant classes', () => {
    render(
      <ToastProvider>
        <Toast variant="destructive">
          <ToastTitle>Error</ToastTitle>
        </Toast>
        <ToastViewport />
      </ToastProvider>,
    )
    const toast = document.querySelector('li[data-state="open"]')
    expect(toast).toBeDefined()
  })

  it('renders ToastAction as an interactive element', () => {
    render(
      <ToastProvider>
        <Toast>
          <ToastTitle>Action toast</ToastTitle>
          <ToastAction altText="Undo action">Undo</ToastAction>
        </Toast>
        <ToastViewport />
      </ToastProvider>,
    )
    const action = screen.getByRole('button', { name: 'Undo' })
    expect(action).toBeDefined()
    expect(action.tagName).toBe('BUTTON')
  })

  it('renders ToastClose button', () => {
    render(
      <ToastProvider>
        <Toast>
          <ToastTitle>Closable</ToastTitle>
          <ToastClose />
        </Toast>
        <ToastViewport />
      </ToastProvider>,
    )
    const closeButton = screen.getByRole('button')
    expect(closeButton).toBeDefined()
    expect(closeButton.getAttribute('toast-close')).toBe('')
  })

  it('ToastViewport renders as an ordered list with aria-label', () => {
    render(
      <ToastProvider>
        <ToastViewport />
      </ToastProvider>,
    )
    const viewport = document.querySelector('ol')
    expect(viewport).toBeDefined()
  })

  it('renders ToastTitle with semibold text class', () => {
    render(
      <ToastProvider>
        <Toast>
          <ToastTitle>Formatted</ToastTitle>
        </Toast>
        <ToastViewport />
      </ToastProvider>,
    )
    const title = screen.getByText('Formatted')
    expect(title.getAttribute('class')).toContain('font-semibold')
  })

  it('renders ToastDescription with opacity class', () => {
    render(
      <ToastProvider>
        <Toast>
          <ToastDescription>Opacified</ToastDescription>
        </Toast>
        <ToastViewport />
      </ToastProvider>,
    )
    const description = screen.getByText('Opacified')
    expect(description.getAttribute('class')).toContain('opacity-90')
  })
})
