'use client'

import { ExternalLink } from 'lucide-react'

/** Heading for the collapsed advanced-metadata group. */
const ADVANCED_METADATA_TITLE = 'Metadata & source'

/** Explains what the advanced group is for, so tags-above is not mistaken for a gap. */
const ADVANCED_METADATA_DESCRIPTION =
  'Optional context that helps you find and revisit this note later. Tags stay visible above for quick editing.'

/**
 * Collapsible "Metadata & source" group of the editor form.
 *
 * Extracted from `editor-view.tsx` to keep that module under the repository's
 * 500-LOC limit (Plan 159 follow-on F6). The group heading is referenced by
 * `aria-labelledby`, so it must stay inside its own `role="group"` container.
 */
export const EditorAdvancedFields = ({
  sourceUrl,
  onSourceUrlChange,
}: {
  sourceUrl: string
  onSourceUrlChange: (value: string) => void
}) => (
  <div
    className="mb-4 space-y-3 rounded-lg border border-dashed border-border bg-muted/30 p-4"
    role="group"
    aria-labelledby="advanced-fields-heading"
  >
    <div>
      <h3 id="advanced-fields-heading" className="font-serif text-[15px] font-semibold text-ink">
        {ADVANCED_METADATA_TITLE}
      </h3>
      <p className="mt-1 text-label leading-relaxed text-ink-mute">
        {ADVANCED_METADATA_DESCRIPTION}
      </p>
    </div>
    <div>
      <label
        htmlFor="source-url"
        className="mb-1 flex items-center gap-1.5 text-label font-semibold uppercase tracking-wide text-ink-faint"
      >
        <ExternalLink className="h-3 w-3" />
        Source URL
      </label>
      <input
        id="source-url"
        value={sourceUrl}
        onChange={(e) => {
          onSourceUrlChange(e.target.value)
        }}
        placeholder="https://…"
        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-[13px] text-ink placeholder:text-ink-faint focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron/30"
      />
    </div>
  </div>
)
