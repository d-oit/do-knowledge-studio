/**
 * Local chat slice (Plan 157 Phase 3).
 *
 * The send path runs BM25 retrieval in a worker with a synchronous fallback,
 * and aborts any in-flight retrieval when the conversation is cleared, reset,
 * or replaced by an import. The abort controller is module-scoped so the
 * in-flight request is owned across action boundaries, not per-caller.
 */
import { search, resetSearchCache, type SearchResult } from '@/lib/search/retrieval'
import { searchAsync } from '@/lib/search/search-worker-client'
import type { ChatMessage } from '../types'
import type { StudioState } from '../store-types'
import { generateId } from './claims-slice'
import type { StudioSlice } from './slice-types'

/** Keys owned by the local chat slice. */
export type ChatSlice = Pick<StudioState, 'chat' | 'chatLoading' | 'sendMessage' | 'clearChat'>

/** Maximum BM25 results requested for a local chat turn. */
const CHAT_RESULT_LIMIT = 5

/** Abort controller for the in-flight local-chat retrieval. */
let chatSendAbort: AbortController | null = null

/** Abort and drop any in-flight chat retrieval. Called by `clearChat`/`resetStore`
 * so a pending send can't append its assistant reply into a cleared/reset
 * conversation (the send is never the active controller afterward, so its
 * completion is dropped in `sendMessage`'s catch). */
export const abortChatSend = (): void => {
  chatSendAbort?.abort()
  chatSendAbort = null
}

/** Builds the local assistant chat reply from BM25 results. Shared by the
 * worker-backed async path and the synchronous fallback so both render an
 * identical, deterministic answer (AGENTS.md: local-first, never hang the UI). */
const buildLocalChatReply = (results: SearchResult[]): ChatMessage => {
  const cited = results.map((r) => ({
    entityId: r.entityId ?? r.id,
    entityName: r.entityName ?? r.name,
    snippet: r.snippet,
  }))
  return {
    id: generateId(),
    role: 'assistant',
    content: results.length
      ? `Based on ${results.length === 1 ? '1 match' : `${results.length} matches`} in your library, here is what I found. ${results[0].snippet} You can open the cited sources for full detail, or ask me to compare them.`
      : "I could not find a direct match in your local library. Try rephrasing with keywords that appear in your entity names or descriptions, or capture a new entity first via the Editor.",
    citations: cited,
    timestamp: new Date().toISOString(),
  }
}

/** Builds the chat slice of the studio store. */
export const createChatSlice: StudioSlice<ChatSlice> = (set, get) => ({
  chat: [],
  chatLoading: false,

  sendMessage: (content) => {
    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    }
    set((state) => ({ chat: [...state.chat, userMsg], chatLoading: true }))

    // Cancel any in-flight retrieval from a previous send so a newer message
    // never races a stale search result (AGENTS.md: AbortController for all
    // async work). The active controller owns state updates; stale ones are
    // dropped on abort.
    chatSendAbort?.abort()
    const controller = new AbortController()
    chatSendAbort = controller

    const { entities, claims } = get()
    return searchAsync(entities, claims, content, CHAT_RESULT_LIMIT, controller.signal)
      .then((results) => {
        if (controller.signal.aborted) return
        const reply = buildLocalChatReply(results)
        set((state) => ({ chat: [...state.chat, reply], chatLoading: false }))
      })
      .catch((err: unknown) => {
        // A stale send no longer owns chat state; the active controller owns
        // the reply and the typing indicator.
        if (chatSendAbort !== controller) return
        set({ chatLoading: false })
        if (err instanceof DOMException && err.name === 'AbortError') return

        // The worker-backed async path failed (worker error, late module
        // load, etc.). Fall back to the synchronous engine so the local-
        // first chat still answers instead of hanging on the indicator.
        let results: SearchResult[] = []
        try {
          results = search(entities, claims, content, CHAT_RESULT_LIMIT)
        } catch (fallbackErr) {
          console.error('Local chat synchronous fallback failed:', fallbackErr)
        }
        const reply = buildLocalChatReply(results)
        set((state) => ({ chat: [...state.chat, reply], chatLoading: false }))
      })
  },

  clearChat: () => {
    abortChatSend()
    set({ chat: [], chatLoading: false })
  },
})

/** Drops the cached search index. Exported so import/reset can share it. */
export { resetSearchCache }
