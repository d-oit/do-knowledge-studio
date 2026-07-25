# ADR 019 — AI Harness Provider Integration (BYO-Key, Client-Side)

**Date**: 2026-07-09
**Status**: Superseded by ADR 025 — OpenRouter + Ollama consolidation replaces multi-provider integration.
**Related**: GOAP actions T1, T2; ADR 017 (chat unification), ADR 018

## Context

`src/components/studio/views/ai-harness-view.tsx` presents provider/model/API-key
controls and a chat surface, but:
- `handleSend` returns a hardcoded `"(Demo response.)"` after `setTimeout(700)` —
  it **never calls the provider**.
- The API key is stored in component `useState`, so it is **lost on reload**,
  despite the UI stating "Stored locally only — never sent anywhere except the
  provider."

The UI therefore promises a capability that does not exist. ADR 018 confirms
there is no backend to proxy requests through.

## Decision

Implement **bring-your-own-key, client-side provider calls**:

1. **Settings persistence (T1).** Persist provider, model, and API key to
   `localStorage` under a dedicated key (e.g. `dks-ai-settings`). Encrypt the key
   at rest using WebCrypto (reusing the AES-GCM helper from ADR 021) with a
   device-scoped key, or — if that is deferred — change the UI copy to say
   plainly that the key is stored in this browser's localStorage.
2. **Real calls (T2).** Add `src/lib/ai/providers.ts` describing each provider's
   endpoint, headers, and request/response shape (OpenAI-compatible, Anthropic,
   Ollama). `handleSend` calls `fetch` directly from the browser to the selected
   provider. Streaming is optional for v1.
3. **Local augmentation.** When "Augment with local knowledge" is on, prepend
   retrieved context from the ADR 022 retrieval engine to the prompt.
4. **Offline / no-key fallback.** With no key (or Ollama unreachable), keep a
   clearly labeled local-only response path; never silently fake a model reply.
5. **Trust model.** Keys and prompts go **only** to the user-selected provider.
   No first-party server sees them. Document this in the settings panel.

## Consequences

- The AI Harness becomes genuinely functional without violating local-first.
- CORS and provider quirks are the user's/provider's concern; Ollama (localhost)
  is the most local-friendly default.
- Removes the misleading demo path; aligns the "Lab" framing from ADR 017.
- Enables removing `z-ai-web-dev-sdk` (unused) in favor of plain `fetch`.

## Alternatives Considered

1. **Server-side proxy for keys.** Rejected: requires a backend (violates
   ADR 018) and defeats the offline value proposition.
2. **Keep it a pure demo.** Acceptable only as an interim step, but the UI must
   then be unambiguously labeled "Demo — not connected" to avoid misleading
   users.
3. **Bundle a provider SDK per vendor.** Rejected: bloats the client; a small
   typed `fetch` adapter per provider is lighter and easier to audit.
