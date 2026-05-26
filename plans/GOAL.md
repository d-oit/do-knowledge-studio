# Goal: do-knowledge-studio

Build a local-first, structured knowledge engine that empowers users to capture, connect, and synthesize information without relying on cloud-based LLMs.

## Core Values
- **Local Sovereignty**: User data is stored in SQLite (OPFS) and never leaves the device.
- **Structural Depth**: Moving beyond flat text to Entities, Claims, and relational Links.
- **Visual Intelligence**: Multiple perspectives on the same data (Graph, Mind Map, Chat).
- **Offline First**: Zero latency, zero dependency on external APIs for core functionality.
- **Security First**: All user content is sanitized before export; API keys are never bundled.

## 2026 Goals (from GitHub Issue Analysis)
1. **Zero Security Vulnerabilities** — Fix XSS in export paths, isolate API keys from VITE_ env vars
2. **All Functional Bugs Resolved** — Fix broken nav, dead code, version inconsistencies
3. **Infrastructure Integrity** — CI timeouts, caching, proper TypeScript configs
4. **Code Quality at Scale** — 80% test coverage, strict TypeScript, consistent error handling
5. **Complete Core Features** — Entity editing, mind map editing, graph layouts, keyboard accessibility
6. **Performance for Large KBs** — Pagination, batch queries, LRU caches, lazy loading
7. **Rich Export Formats** — PNG, PDF, DOCX with shared export core
