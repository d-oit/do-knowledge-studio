import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../tabs'

describe('Tabs', () => {
  it('renders a tablist with triggers and content', () => {
    render(
      <Tabs defaultValue="account">
        <TabsList>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="password">Password</TabsTrigger>
        </TabsList>
        <TabsContent value="account">Account settings</TabsContent>
        <TabsContent value="password">Password settings</TabsContent>
      </Tabs>,
    )
    const tablist = screen.getByRole('tablist')
    expect(tablist).toBeDefined()
    expect(tablist.getAttribute('data-slot')).toBe('tabs-list')
    expect(screen.getByRole('tab', { name: 'Account' })).toBeDefined()
    expect(screen.getByRole('tab', { name: 'Password' })).toBeDefined()
  })

  it('shows active tab content by default', () => {
    render(
      <Tabs defaultValue="account">
        <TabsList>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="password">Password</TabsTrigger>
        </TabsList>
        <TabsContent value="account">Account settings</TabsContent>
        <TabsContent value="password">Password settings</TabsContent>
      </Tabs>,
    )
    expect(screen.getByText('Account settings')).toBeDefined()
  })

  it('marks the default tab as active', () => {
    render(
      <Tabs defaultValue="account">
        <TabsList>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="password">Password</TabsTrigger>
        </TabsList>
        <TabsContent value="account">Account</TabsContent>
        <TabsContent value="password">Password</TabsContent>
      </Tabs>,
    )
    const accountTab = screen.getByRole('tab', { name: 'Account' })
    expect(accountTab.getAttribute('data-state')).toBe('active')
    expect(accountTab.getAttribute('aria-selected')).toBe('true')
  })

  it('switches tabs on click', () => {
    render(
      <Tabs defaultValue="account">
        <TabsList>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="password">Password</TabsTrigger>
        </TabsList>
        <TabsContent value="account">Account</TabsContent>
        <TabsContent value="password">Password</TabsContent>
      </Tabs>,
    )
    const passwordTab = screen.getByRole('tab', { name: 'Password' })
    // Radix Tabs selects on pointerDown, but in jsdom keyboard activation is more reliable
    fireEvent.keyDown(passwordTab, { key: 'Enter' })
    expect(passwordTab.getAttribute('data-state')).toBe('active')
    expect(passwordTab.getAttribute('aria-selected')).toBe('true')
    const accountTab = screen.getByRole('tab', { name: 'Account' })
    expect(accountTab.getAttribute('data-state')).toBe('inactive')
  })

  it('TabsList applies muted background classes', () => {
    render(
      <Tabs>
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
        </TabsList>
      </Tabs>,
    )
    const tablist = screen.getByRole('tablist')
    expect(tablist.className).toContain('bg-muted')
    expect(tablist.className).toContain('inline-flex')
    expect(tablist.className).toContain('rounded-lg')
  })

  it('TabsTrigger applies active background class', () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">Active</TabsTrigger>
        </TabsList>
      </Tabs>,
    )
    const tab = screen.getByRole('tab', { name: 'Active' })
    expect(tab.className).toContain('data-[state=active]:bg-background')
  })

  it('TabsContent sets data-slot and flex classes', () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Content A</TabsContent>
      </Tabs>,
    )
    const content = screen.getByText('Content A')
    expect(content.getAttribute('data-slot')).toBe('tabs-content')
    expect(content.className).toContain('flex-1')
  })

  it('accepts custom className on Tabs root', () => {
    const { container } = render(
      <Tabs className="my-tabs" defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Content</TabsContent>
      </Tabs>,
    )
    const root = container.querySelector('[data-slot="tabs"]')
    expect(root).toBeDefined()
    expect(root?.className).toContain('my-tabs')
  })
})
