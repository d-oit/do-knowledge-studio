'use client'

import { useState } from 'react'
import { X, Plus, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ENTITY_TYPE_META, type EntityType } from '@/lib/studio/types'
import { TypeSelector } from './type-selector'

/** Entity editor header with type badge, name input, and description. */
export const EditorHeader = ({
  editing,
  name,
  onNameChange,
  type,
  description,
  onDescriptionChange,
}: {
  editing: { updatedAt: string } | null
  name: string
  onNameChange: (name: string) => void
  type: EntityType
  description: string
  onDescriptionChange: (description: string) => void
}) => {
  const meta = ENTITY_TYPE_META[type as keyof typeof ENTITY_TYPE_META]

  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center gap-2">
        <span className={cn('flex items-center gap-1.5 rounded-full px-2.5 py-1 text-label font-semibold', meta.bg, meta.text)}>
          {meta.label}
        </span>
        {editing && (
          <span className="text-label text-ink-faint">
            Edited {new Date(editing.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>
      <label htmlFor="entity-name" className="sr-only">Entity name</label>
      <input
        id="entity-name"
        value={name}
        onChange={(e) => { onNameChange(e.target.value) }}
        placeholder="Entity name…"
        className="w-full bg-transparent font-serif text-3xl font-semibold leading-tight tracking-tight text-ink placeholder:text-ink-faint/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40 focus-visible:ring-inset"
      />
      <label htmlFor="entity-description" className="sr-only">Description</label>
      <textarea
        id="entity-description"
        value={description}
        onChange={(e) => { onDescriptionChange(e.target.value) }}
        placeholder="A short description (optional)…"
        rows={2}
        className="mt-2 w-full resize-none bg-transparent text-[14px] leading-relaxed text-ink-mute placeholder:text-ink-faint/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40 focus-visible:ring-inset"
      />
    </div>
  )
}

/** Tag list editor with type selector, add/remove controls. */
export const EditorTags = ({
  tags,
  onTagsChange,
  type,
  showTypeMenu,
  onToggleTypeMenu,
  onSelectType,
}: {
  tags: string[]
  onTagsChange: (tags: string[]) => void
  type: EntityType
  showTypeMenu: boolean
  onToggleTypeMenu: () => void
  onSelectType: (type: EntityType) => void
}) => {
  const [newTag, setNewTag] = useState('')

  const addTag = () => {
    const tagName = newTag.trim().replace(/^#/, '')
    if (tagName && !tags.includes(tagName)) onTagsChange([...tags, tagName])
    setNewTag('')
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <TypeSelector
        type={type}
        showMenu={showTypeMenu}
        onToggleMenu={onToggleTypeMenu}
        onSelect={onSelectType}
      />

      {tags.map((t) => (
        <span
          key={t}
          className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-label font-medium text-ink-soft"
        >
          #{t}
          <button
            onClick={() => { onTagsChange(tags.filter((x) => x !== t)) }}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-ink-faint hover:text-red-500 focus-ring"
            aria-label={`Remove tag ${t}`}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      <div className="flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5">
        <Tag className="h-2.5 w-2.5 text-ink-faint" />
        <input
          value={newTag}
          onChange={(e) => { setNewTag(e.target.value) }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addTag()
            }
          }}
          placeholder="add tag"
          className="w-16 bg-transparent text-label text-ink-soft placeholder:text-ink-faint focus:outline-none"
          aria-label="Add tag"
        />
        {newTag && (
          <button onClick={addTag} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-saffron hover:text-saffron-deep focus-ring" aria-label="Add tag">
            <Plus className="h-2.5 w-2.5" />
          </button>
        )}
      </div>
    </div>
  )
}
