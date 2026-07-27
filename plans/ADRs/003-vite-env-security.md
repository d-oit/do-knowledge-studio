# ADR 003: API Key Isolation from VITE_ Environment Variables

**Status**: Implemented

## Context
API keys for LLM providers (OpenRouter, Kilo Gateway) are currently read from `import.meta.env.VITE_OPENROUTER_API_KEY` and `import.meta.env.VITE_KILO_API_KEY`. Vite environment variables prefixed with `VITE_` are exposed to the client-side bundle at build time. If the application is deployed (even as a static site), these keys would be visible in the JavaScript bundle.

## Decision
We will remove reliance on `VITE_` environment variables for secret values and instead use a **runtime config stored in IndexedDB**:

1. **Store API keys in IndexedDB** via the existing LLM config system (`src/lib/llm/config.ts`), which already uses `localStorage` — migrate to IndexedDB for better isolation.
2. **Remove `VITE_` env var reading** from LLM provider implementations (`openrouter.ts`, `kilo.ts`).
3. **Add a settings UI** for users to input their API keys at runtime (already partially planned in issue #188).
4. **Never hardcode, never bundle**: Keys must never appear in source code or the built bundle.
5. **Audit for compliance**: Scan all source files for `VITE_` references to ensure no accidental exposures remain.

## Alternatives Considered
- **Keep `VITE_` with `.env` documentation**: Relies on developers to never deploy the .env file with production builds. Error-prone and violates principle of least surprise.
- **Proxy server**: Would require a backend, violating the local-first constraint.
- **Encrypted localStorage**: Improves on localStorage but IndexedDB provides better isolation from extension-based theft.

## Implementation Plan
1. Update `src/lib/llm/config.ts`:
   - Migrate from `localStorage` to IndexedDB using a simple `idb-keyval` wrapper (or raw IndexedDB)
   - Remove `VITE_OPENROUTER_API_KEY` and `VITE_KILO_API_KEY` env var reading
   - Add migration path: on first load, check localStorage for existing keys and move them to IndexedDB
2. Update provider implementations:
   - `openrouter.ts`: Remove `fallback to import.meta.env.VITE_OPENROUTER_API_KEY`
   - `kilo.ts`: Remove `fallback to import.meta.env.VITE_KILO_API_KEY`
3. Create settings panel (plan 18 or standalone):
   - API key input fields with show/hide toggle
   - "Test connection" button
   - Visual indicator of which provider is configured
4. Add `scripts/audit-vite-env.sh` to scan for `VITE_` that might indicate exposed secrets
5. Remove `VITE_*` from `.env.example` so new developers don't adopt the pattern

## Consequences
- **Positive**: API keys never appear in the built JavaScript bundle
- **Positive**: Users can enter keys at runtime without `.env` files
- **Positive**: IndexedDB provides better security boundary than localStorage
- **Negative**: Settings UI must be implemented (was already planned for LLM provider system)
- **Negative**: Key must be re-entered if IndexedDB is cleared (acceptable tradeoff)
- **Negative**: Slightly more complex onboarding (user must enter key in UI)

## Acceptance Criteria
- [ ] No `VITE_` env vars are read in `src/lib/llm/` providers
- [ ] API keys stored in IndexedDB (not localStorage, not env vars)
- [ ] Migration path exists for existing localStorage keys
- [ ] Settings UI allows entering/updating/clearing keys
- [ ] `scripts/audit-vite-env.sh` passes with zero VITE_ references related to secrets
- [ ] `npm run typecheck` passes
- [ ] E2E test: user enters key → LLM call succeeds → bundle inspection shows no key
