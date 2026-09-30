'use client'

import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { MENTION_SCHEME } from '@/lib/editor/mention'
import { sanitizeUrl } from '@/lib/security'

/** Preserve the reserved dks:// mention protocol (sanitizeUrl strips non-standard schemes). */
const mentionAwareUrlTransform = (url: string): string =>
  url.startsWith(MENTION_SCHEME) ? url : sanitizeUrl(url)

/**
 * Rendered markdown preview for the editor.
 *
 * Extracted from `editor-view.tsx` to keep that module under the repository's
 * 500-LOC limit (Plan 159 follow-on F6). Rendering rules are unchanged:
 * `dks://entity/…` mention tokens become inert chips, every other link is
 * sanitized and opened with `noopener noreferrer`.
 */
export const EditorPreview = ({ content }: { content: string }) => (
  <div className="prose prose-sm dark:prose-invert max-w-none min-h-[420px] rounded-lg border border-border bg-background p-4">
    <Markdown
      urlTransform={mentionAwareUrlTransform}
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children }) => {
          // Mention tokens render as styled chips (no navigation);
          // anything else stays a normal external link.
          if (href?.startsWith(MENTION_SCHEME)) {
            const entityId = href.slice(MENTION_SCHEME.length)
            return (
              <span
                data-mention-id={entityId}
                className="mx-0.5 rounded-full bg-saffron-soft px-2 py-0.5 font-medium text-saffron-deep no-underline"
              >
                {children}
              </span>
            )
          }
          const safeHref = typeof href === 'string' && href ? sanitizeUrl(href) : ''
          if (!safeHref) return <span>{children}</span>
          return (
            <a href={safeHref} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          )
        },
      }}
    >
      {content || '_Nothing to preview._'}
    </Markdown>
  </div>
)
