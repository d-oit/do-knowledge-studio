# ADR 007: Adoption of do-web-doc-resolver for External Ingestion

**Status**: Superseded

## Context
`do-knowledge-studio` is a local-first knowledge management system. To provide high-signal context for RAG and entity hydration, it requires a robust way to fetch and process external web content and documents. `do-web-doc-resolver` provides an intelligent, cost-optimized cascade for this purpose.

## Decision
We will adopt `do-web-doc-resolver` as the primary ingestion engine for all external data sources (Web, PDF, Documents).

## Impact
- **Cost Optimization**: Prioritizes free sources (Exa MCP, llms.txt) before paid APIs.
- **Data Quality**: Provides clean, LLM-ready markdown by stripping boilerplate.
- **Multi-Modal**: Support for PDF, DOCX, and image-based content (OCR).
- **Local-First Performance**:
    - **Routing Memory**: Tracks domain performance to avoid failing endpoints.
    - **Semantic Cache**: Integrated with SQLite for offline-ready access.
- **User Control**: Exposure of execution profiles (`free`, `fast`, `quality`) to the user.

## Alternatives Considered
- **Direct Playwright/Scrapy**: Too much maintenance overhead for boilerplate removal.
- **Tavily/Firecrawl only**: High cost and potential for context bloat.

## Implementation Details
- Integration via the `do-web-doc-resolver` skill.
- SQLite table `web_cache` for local semantic storage.
- UI enhancements in Entity Creation and RAG chat to support external context.

## Superseded Reason (2026-08-02)

This ADR is superseded because:

1. **Architecture Mismatch**: `do-web-doc-resolver` is a Python CLI tool designed for agent workflows, not a JavaScript/TypeScript library suitable for browser-based integration. Integrating a Python subprocess into a Next.js web app violates the local-first constraint.

2. **Simpler Alternative Exists**: The app already implements web content fetching via Jina Reader (`src/lib/ai/research.ts`) which provides browser-native URL content resolution without external dependencies.

3. **Persistence Layer Changed**: The proposed SQLite `web_cache` table was never implemented. The project migrated from SQLite WASM to Zustand + localStorage (ADR 018).

4. **Agent Skill Available**: The `do-web-doc-resolver` skill remains available in `.claude/skills/` for agent workflows and CLI usage, but is not integrated into the app's runtime architecture.

5. **Completed Functionality**: The app's AI harness already supports URL content fetching and context injection for RAG chat, achieving the original goal through a simpler, browser-native approach.
