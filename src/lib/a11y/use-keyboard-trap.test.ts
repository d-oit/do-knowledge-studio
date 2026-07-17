import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import * as React from 'react'
import { useFocusTrap } from './use-keyboard-trap'

function createContainer(): HTMLElement {
  const container = document.createElement('div')
  container.innerHTML = `
    <button data-testid="btn1">Button 1</button>
    <input data-testid="input1" type="text" />
    <button data-testid="btn2">Button 2</button>
  `
  document.body.appendChild(container)
  return container
}

function pressKey(key: string, options: Partial<KeyboardEventInit> = {}) {
  document.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      ...options,
    }),
  )
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('useFocusTrap', () => {
  it('focuses first focusable element on activation', () => {
    const container = createContainer()
    const ref = React.createRef<HTMLElement>()
    ;(ref as React.MutableRefObject<HTMLElement | null>).current = container

    renderHook(() => useFocusTrap(ref, true))

    const firstButton = container.querySelector('[data-testid="btn1"]') as HTMLElement
    expect(document.activeElement).toBe(firstButton)
  })

  it('wraps Tab within trap', () => {
    const container = createContainer()
    const ref = React.createRef<HTMLElement>()
    ;(ref as React.MutableRefObject<HTMLElement | null>).current = container

    renderHook(() => useFocusTrap(ref, true))

    const lastButton = container.querySelector('[data-testid="btn2"]') as HTMLElement
    lastButton.focus()

    act(() => {
      pressKey('Tab')
    })

    const firstButton = container.querySelector('[data-testid="btn1"]') as HTMLElement
    expect(document.activeElement).toBe(firstButton)
  })

  it('wraps Shift+Tab within trap', () => {
    const container = createContainer()
    const ref = React.createRef<HTMLElement>()
    ;(ref as React.MutableRefObject<HTMLElement | null>).current = container

    renderHook(() => useFocusTrap(ref, true))

    const firstButton = container.querySelector('[data-testid="btn1"]') as HTMLElement
    firstButton.focus()

    act(() => {
      pressKey('Tab', { shiftKey: true })
    })

    const lastButton = container.querySelector('[data-testid="btn2"]') as HTMLElement
    expect(document.activeElement).toBe(lastButton)
  })

  it('releases trap on Escape', () => {
    const container = createContainer()
    const ref = React.createRef<HTMLElement>()
    ;(ref as React.MutableRefObject<HTMLElement | null>).current = container

    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()

    renderHook(() => useFocusTrap(ref, true))

    act(() => {
      pressKey('Escape')
    })

    expect(document.activeElement).toBe(trigger)
  })
})
