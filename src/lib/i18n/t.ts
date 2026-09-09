/**
 * Shared i18n scaffolding (N5, plan 135).
 *
 * Typed message maps for user-facing strings. Each feature/view owns a
 * per-scope module under `src/lib/i18n/messages/<scope>.ts` exporting a
 * `t` bound to its own keys — no central index, so parallel workstreams
 * never race on a shared registry. A future `next-intl`/`react-i18next`
 * layer can aggregate the per-scope maps additively.
 *
 * Convention (AGENTS.md: never hardcode user-facing strings):
 *   const messages = { 'editor.mention.placeholder': 'Search entities…' } as const
 *   export const t = makeT(messages)
 *   // <input placeholder={t('editor.mention.placeholder')} />
 *
 * Dynamic strings use a function entry — args are interpolated at the call
 * site, keeping locale-sensitive formatting in the view.
 */

/** A static message or a template function receiving interpolation args. */
export type MessageEntry = string | ((...args: string[]) => string)

/**
 * Builds a typed `t` helper for a const message map.
 * Keys are enforced at compile time via `keyof T`.
 */
export const makeT = <const T extends Record<string, MessageEntry>>(
  messages: T,
): ((key: keyof T, ...args: string[]) => string) => {
  // Materialize the message map once; Map.get is a bounded retrieval and does
  // not expose prototype-chain lookups, so dynamic keys are injection-safe
  // (Codacy `detect-object-injection`).
  const entries = new Map<string, MessageEntry>(Object.entries(messages))
  return (key, ...args) => {
    // `keyof T` is `string` per the bound, but a numeric/symbol key can be
    // passed at runtime; Object.entries keys are always strings, so coerce
    // before the Map lookup to keep both sides aligned.
    const entry = entries.get(String(key))
    if (typeof entry === 'function') return entry(...args)
    if (entry !== undefined) return entry
    return String(key)
  }
}