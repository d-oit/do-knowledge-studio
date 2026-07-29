import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
} from '../breadcrumb'

describe('Breadcrumb', () => {
  it('renders a nav element with aria-label', () => {
    const { container } = render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>,
    )
    const nav = container.querySelector('[data-slot="breadcrumb"]')
    expect(nav).toBeDefined()
    expect(nav?.getAttribute('aria-label')).toBe('breadcrumb')
  })

  it('renders breadcrumb list with correct data-slot', () => {
    const { container } = render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>,
    )
    const list = container.querySelector('[data-slot="breadcrumb-list"]')
    expect(list).toBeDefined()
    expect(list?.tagName).toBe('OL')
  })

  it('renders breadcrumb items as list items', () => {
    const { container } = render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>,
    )
    const item = container.querySelector('[data-slot="breadcrumb-item"]')
    expect(item).toBeDefined()
    expect(item?.tagName).toBe('LI')
  })

  it('BreadcrumbLink renders as an anchor with href', () => {
    const { container } = render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/section">Section</BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>,
    )
    const link = container.querySelector('[data-slot="breadcrumb-link"]')
    expect(link).toBeDefined()
    expect(link?.tagName).toBe('A')
    expect(link?.getAttribute('href')).toBe('/section')
  })

  it('BreadcrumbPage marks current page with aria-current', () => {
    const { container } = render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>Current page</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>,
    )
    const page = container.querySelector('[data-slot="breadcrumb-page"]')
    expect(page).toBeDefined()
    expect(page?.getAttribute('aria-current')).toBe('page')
    expect(page?.getAttribute('aria-disabled')).toBe('true')
  })

  it('BreadcrumbSeparator renders with role presentation', () => {
    const { container } = render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/a">A</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/b">B</BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>,
    )
    const sep = container.querySelector('[data-slot="breadcrumb-separator"]')
    expect(sep).toBeDefined()
    expect(sep?.getAttribute('role')).toBe('presentation')
    expect(sep?.getAttribute('aria-hidden')).toBe('true')
  })

  it('BreadcrumbEllipsis renders with More sr-only text', () => {
    const { container } = render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbEllipsis />
        </BreadcrumbList>
      </Breadcrumb>,
    )
    const ellipsis = container.querySelector('[data-slot="breadcrumb-ellipsis"]')
    expect(ellipsis).toBeDefined()
    expect(ellipsis?.getAttribute('role')).toBe('presentation')
    expect(screen.getByText('More')).toBeDefined()
  })

  it('accepts custom className on BreadcrumbList', () => {
    const { container } = render(
      <Breadcrumb>
        <BreadcrumbList className="my-crumb">
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>,
    )
    const list = container.querySelector('[data-slot="breadcrumb-list"]')
    expect(list?.className).toContain('my-crumb')
  })
})
