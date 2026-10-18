import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { logRouteError } = vi.hoisted(() => ({ logRouteError: vi.fn() }))

vi.mock('@/lib/logging/logger', () => ({
  logger: {
    child: () => ({ error: logRouteError }),
  },
}))

import RouteError from './error'

describe('route error boundary', () => {
  beforeEach(() => {
    logRouteError.mockClear()
  })

  it('shows a generic fallback and retries the failed segment', () => {
    const retry = vi.fn()

    render(<RouteError error={new Error('Private server detail')} retry={retry} />)

    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined()
    expect(screen.queryByText('Private server detail')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(retry).toHaveBeenCalledTimes(1)
  })
})
