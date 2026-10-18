# ADR 003: API Key Isolation from VITE_ Environment Variables

**Status**: Implemented

## Context
This decision addresses the original Vite-era use of `import.meta.env.VITE_OPENROUTER_API_KEY` and `import.meta.env.VITE_KILO_API_KEY` for LLM providers. Vite environment variables prefixed with `VITE_` are exposed to the client-side bundle at build time, so deployed client bundles would expose those values.

## Decision
We will remove reliance on `VITE_` environment variables for secret values and instead use **runtime user-entered configuration**:

1. **Store API keys locally in IndexedDB**, encrypted with WebCrypto AES-GCM. The encryption key seed is kept in `sessionStorage`; keys can be decrypted during a tab session and must be re-entered when the key is unavailable. See ADR 018 for the persistence exception and threat boundaries.
2. **Remove `VITE_` env var reading** from LLM provider implementations (`openrouter.ts`, `kilo.ts`).
3. **Add a settings UI** for users to input their API keys at runtime.
4. **Never hardcode, never bundle**: Keys must never appear in source code or the built bundle.
5. **Audit for compliance**: Scan all source files for `VITE_` references to ensure no accidental exposures remain.

## Alternatives Considered

- **Keep `VITE_` with `.env` documentation**: Rejected because client-prefixed
  build variables expose secrets in the bundle.
- **Proxy server**: Rejected because it would require a backend, contrary to
  the local-first constraint.

## Consequences

- **Positive**: API keys are entered at runtime and are not bundled from
  environment variables.
- **Positive**: New settings writes store the API key encrypted in IndexedDB.
- **Negative**: If the tab-scoped session key is unavailable, the saved
  ciphertext cannot be decrypted and the API key must be re-entered.
- **Security boundary**: This protects persisted ciphertext when its key is
  absent; it does not protect against same-origin script executing in a session
  that can access the `sessionStorage` key. See ADR 018.

## Implementation Status

The runtime settings UI, provider configuration, encrypted IndexedDB writes,
and localStorage-to-IndexedDB migration are implemented in
`src/lib/studio/ai-settings.ts`. Migration validates the legacy record, encrypts
any plaintext API key before writing, validates the IndexedDB read-back, then
removes the legacy setting. Older IndexedDB plaintext API-key records are still
accepted on read for backward compatibility. Library state remains in Zustand
+ `localStorage` as specified by ADR 018.

The API-key encryption key seed is stored in `sessionStorage`, not the API key.
The seed remains accessible to same-origin script during the tab session and
may be copied to a tab opened with an opener; closing all tabs holding the key
ends the ability to decrypt the IndexedDB ciphertext.
