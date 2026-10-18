'use client'

import type { ReactNode } from 'react'

export interface NavigationGroup<Item> {
  label: string
  items: Item[]
}

/** Shared accessible grouping structure for sidebar and mobile navigation. */
export const NavGroupList = <Item extends { id: string }>({
  groups,
  className,
  groupClassName,
  children,
}: {
  groups: NavigationGroup<Item>[]
  className: string
  groupClassName: string
  children: (item: Item) => ReactNode
}) => (
  <div className={className}>
    {groups.map((group) => (
      <div key={group.label} className={groupClassName}>
        <div className="mb-1.5 px-2 text-caption font-semibold uppercase tracking-[0.14em] text-ink-faint">
          {group.label}
        </div>
        <ul className="space-y-0.5">
          {group.items.map(children)}
        </ul>
      </div>
    ))}
  </div>
)
