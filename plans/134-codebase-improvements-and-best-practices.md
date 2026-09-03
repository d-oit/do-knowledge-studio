# Plan 134: Codebase Improvements and 2026 Best Practices

**Goal**: Implement high-impact security, performance, and tooling improvements identified in the 2026 best practices audit.

## Objectives

1. **Security Hardening**:
   - WebRTC Room Encryption: Add \`password?: string\` to \`joinRoom\` options in \`src/lib/sync/doc.ts\` to enable Web Crypto AES-GCM encryption on signaling and data channels.
   - Content Security Policy: Configure CSP and defense-in-depth security headers (\`X-Content-Type-Options\`, \`X-Frame-Options\`, \`Referrer-Policy\`) in \`next.config.ts\`.
   - DOM Clobbering Defense: Enable \`SANITIZE_NAMED_PROPS: true\` in \`sanitizeHtml\` (\`src/lib/security.ts\`).

2. **Framework & Tooling Modernization**:
   - Strict Mode: Enable \`reactStrictMode: true\` in \`next.config.ts\`.
   - TypeScript Configuration: Remove deprecated \`"baseUrl": "."\` and \`"ignoreDeprecations": "6.0"\` in \`tsconfig.base.json\` (TS 7.0 readiness); upgrade \`"target"\` to \`"ES2022"\` in \`tsconfig.json\`.
   - Dead Dependency Cleanup: Remove \`uuid\` (0 imports, native \`crypto.randomUUID()\` used) and \`tailwindcss-animate\` (replaced by \`tw-animate-css\`).
   - Orphaned Config: Delete \`tailwind.config.ts\` (Tailwind v4 is CSS-first; file is never loaded).
   - pnpm 10 Settings: Move \`overrides\` to top-level \`package.json\` to eliminate pnpm 10 warning.

3. **Performance & Store Optimization**:
   - Eliminate Full-Store Subscriptions: Replace \`useStudioStore()\` destructuring in \`topbar.tsx\`, \`sidebar.tsx\`, and \`shortcuts-dialog.tsx\` with atomic selectors to prevent unnecessary re-renders.
   - Hydration Awareness: Add \`useStoreHydrated()\` hook in \`src/lib/studio/use-hydrated.ts\` to provide clean client-side hydration status.

4. **Code Quality & AGENTS.md Compliance**:
   - Max LOC Compliance: Split oversized \`src/components/studio/__tests__/keyboard-nav.test.tsx\` (791 lines) into \`keyboard-nav-dialogs.test.tsx\` and \`keyboard-nav.test.tsx\` (< 500 LOC each).
   - Arrow Functions for Module-Scope Helpers: Convert \`createLocalStorageMock\` in \`src/test/setup.ts\` and \`SidebarNav\` in \`sidebar.tsx\` to arrow functions (DeepSource JS-0067 compliance).
   - Redundant CSS Utilities: Remove manual \`.text-balance\`, \`.text-pretty\`, and \`.sr-only\` from \`globals.css\` (natively provided by Tailwind v4).

## Quality Checklist
- [ ] Max 500 LOC per file respected across all new/modified files.
- [ ] Named exports only.
- [ ] No \`any\` types; strict TypeScript.
- [ ] All tests pass (\`pnpm run test\`).
- [ ] Typecheck passes (\`pnpm run typecheck\`).
- [ ] Lint passes (\`pnpm run lint\`).
- [ ] Build passes (\`pnpm run build\`).
- [ ] Minimal quality gate passes (\`./scripts/minimal_quality_gate.sh\`).
- [ ] Full quality gate passes (\`./scripts/quality_gate.sh\`).
