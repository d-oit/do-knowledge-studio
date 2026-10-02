import { Quote, Sparkles } from 'lucide-react'
import type { ChatMessage, Entity } from '@/lib/studio/types'
import { PanelCloseButton } from './right-panel-close-button'

/** Dedupes chat citations for rendering (same entityId+snippet repeats on retries). */
const dedupeCitations = (
  citations: ChatMessage['citations'],
): NonNullable<ChatMessage['citations']> => {
  const seen = new Set<string>()
  const deduped: NonNullable<ChatMessage['citations']> = []
  for (const citation of citations ?? []) {
    const key = JSON.stringify([citation.entityId, citation.snippet])
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(citation)
  }
  return deduped
}

interface CitationsPanelProps {
  chat: ChatMessage[]
  entities: Entity[]
  onClose: () => void
}

/** Lists sources cited by the AI assistant in chat. */
export const CitationsPanel = ({ chat, entities, onClose }: CitationsPanelProps) => {
  const lastAssistant = [...chat].reverse().find((message) => message.role === 'assistant')
  const citations = dedupeCitations(lastAssistant?.citations)

  return (
    <aside className="hidden h-full w-[320px] shrink-0 flex-col border-l border-border bg-background wide:flex">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Quote className="h-3.5 w-3.5 text-saffron" />
          <h2 className="font-serif text-[14px] font-semibold text-ink">Cited sources</h2>
        </div>
        <PanelCloseButton onClose={onClose} />
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {citations.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <Sparkles className="h-8 w-8 text-ink-faint/40" />
            <p className="px-6 text-[12px] text-ink-mute">
              When the assistant cites your library, the sources appear here for verification.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {citations.map((citation, index) => (
              <li
                key={JSON.stringify([citation.entityId, citation.snippet])}
                className="rounded-md border border-border bg-muted/30 p-3"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-saffron text-badge font-bold text-white">
                    {index + 1}
                  </span>
                  <span className="text-[12px] font-medium text-ink">{citation.entityName}</span>
                </div>
                <p className="text-label leading-snug text-ink-mute">{citation.snippet}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-border px-4 py-2.5">
        <div className="flex items-center gap-1.5 text-label text-ink-faint">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Grounded in {entities.length} local entities
        </div>
      </div>
    </aside>
  )
}
