# Plan 12: do-web-doc-resolver Implementation Roadmap

**Date**: 2026-05-07
**Status**: DRAFT
**ADR Reference**: [ADR 007: Adoption of do-web-doc-resolver](./ADRs/007-doc-resolver-integration.md)

## 1. Task Analysis
- **Goal**: Seamlessly ingest web and document content into the local-first studio.
- **Tech Stack**: SQLite WASM + OPFS, React, TypeScript, Vitest, Playwright.
- **Key Challenges**: Handling async external fetches in a local-first environment without UI lag.

## 2. Phase 1: Foundation (Database & Service)
- **Task 1.1: Schema Migration**
    - Create `src/db/migrations/007_doc_resolver.sql`.
    - Define `web_cache` table: `url`, `content`, `format`, `resolved_at`, `metadata`.
    - Define `routing_memory` table: `domain`, `success_rate`, `latency`, `preferred_mode`.
- **Task 1.2: Resolver Service (`src/lib/resolver.ts`)**
    - Implement a typed wrapper for the `do-web-doc-resolver` skill.
    - Add logic for "Semantic Cache First" retrieval.
    - Implement "Routing Memory" lookups to choose execution profiles (`free` vs `quality`).

## 3. Phase 2: Ingestion Logic (Background Jobs)
- **Task 2.1: Job Queue Implementation**
    - Extend existing job coalescing logic to handle `EXTERNAL_FETCH` types.
    - Ensure jobs are persisted in SQLite to resume after app restart.
- **Task 2.2: Multi-Modal Handlers**
    - Add specialized handlers for PDF and DOCX using the resolver's multi-modal capabilities.
    - Implement OCR support for image-heavy pages.

## 4. Phase 3: UI Integration
- **Task 3.1: Entity Auto-Hydration UI**
    - Update `src/components/EntityForm.tsx` to include a "Fetch from URL/File" button.
    - Add progress indicators for background ingestion.
- **Task 3.2: RAG Context Enrichment**
    - Modify `src/features/chat/aiHarness.ts` to trigger external fetches when local context is insufficient.
    - Update chat UI to show "Sourcing external data..." status.

## 5. Phase 4: Validation & Quality Gate
- **Task 4.1: Unit Tests**
    - `src/lib/resolver.test.ts`: Mocking skill calls and cache hits.
    - `src/db/repository/webCache.test.ts`: CRUD for cache and memory tables.
- **Task 4.2: Integration Tests**
    - E2E flow: User enters URL -> Entity is created with auto-populated description and claims.
    - E2E flow: Chat query triggers external search -> Combined local/external answer returned.

## 6. Execution Strategy
- **Sequential**: Phase 1 must be completed before Phase 2.
- **Parallel**: UI components and Testing can be developed concurrently once the service layer is stable.

## 7. Quality Gates
1.  **Gate 1**: DB migrations pass and service layer tests reach 90% coverage.
2.  **Gate 2**: Job queue handles 10+ concurrent fetches without UI degradation.
3.  **Gate 3**: E2E critical journeys pass on Chromium and Mobile viewports.
