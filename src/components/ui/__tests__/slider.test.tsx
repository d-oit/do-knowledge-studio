import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Slider } from '../slider'


class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', TestResizeObserver)
})

describe('Slider', () => {
  it('exposes its current value and bounds to assistive technology', () => {
    render(<Slider defaultValue={[40]} min={0} max={80} step={5} />)

    const slider = screen.getByRole('slider')
    expect(slider).toHaveAttribute('aria-valuenow', '40')
    expect(slider).toHaveAttribute('aria-valuemin', '0')
    expect(slider).toHaveAttribute('aria-valuemax', '80')
  })

  it('updates its value with keyboard input', () => {
    render(<Slider defaultValue={[40]} min={0} max={80} step={5} />)

    const slider = screen.getByRole('slider')
    fireEvent.keyDown(slider, { key: 'ArrowRight' })

    expect(slider).toHaveAttribute('aria-valuenow', '45')
  })
})
