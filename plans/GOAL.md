# Goal: do-knowledge-studio

Build a local-first, structured knowledge engine that empowers users to capture, connect, and synthesize information without relying on cloud-based LLMs.

## Core Values
- **Local Sovereignty**: User data is stored in Zustand + localStorage and never leaves the device.
- **Structural Depth**: Moving beyond flat text to Entities, Claims, and relational Links.
- **Visual Intelligence**: Multiple perspectives on the same data (Graph, Mind Map, Chat).
- **Offline First**: Zero latency, zero dependency on external APIs for core functionality.
- **Security First**: All user content is sanitized before export; API keys are session-only.

## Current Architecture (as of 2026-07-24)
- Next.js 16 / React 19 / Tailwind 4 / shadcn / Zustand
- Persistence: Zustand + localStorage (validated with Zod schemas)
- Search: BM25 keyword ranking (not semantic/vector)
- AI: OpenRouter and Ollama providers via AI Harness
- Sync: Yjs/WebRTC infrastructure (opt-in, one-way snapshot)
- Export: JSON, Markdown, HTML, PDF, DOCX, Encrypted HTML

## 2026 Goals (from GitHub Issue Analysis)
1. **Zero Security Vulnerabilities** — XSS fixes in export paths, session-only API keys ✓
2. **All Functional Bugs Resolved** — Broken nav, dead code, version sync ✓
3. **Infrastructure Integrity** — CI timeouts, caching, TypeScript configs ✓
4. **Code Quality at Scale** — Test coverage, strict TypeScript, error handling ✓
5. **Complete Core Features** — Entity editing, mind map, graph layouts ✓
6. **Performance for Large KBs** — Pagination, batch queries, lazy loading ✓
7. **Rich Export Formats** — PNG, PDF, DOCX with shared export core ✓
8. **Data Integrity** — Zod validation at all boundaries (Plan 072) ✓
9. **Honest Product Surface** — Accurate labels, no false-success controls (Plan 072) ✓

## Remaining Work (Plan 073)
- Bidirectional Yjs/Zustand sync bridge
- UI/UX hardening (44px targets, ARIA tree, Playwright device coverage)
- Full accessibility audit
