# Plan 12: do-web-doc-resolver Integration

**Date**: 2026-05-07  
**Status**: PROPOSED  
**Goal**: Integrate the `do-web-doc-resolver` skill into core workflows to enhance local knowledge with high-signal external data.

## 12.1 RAG Context Enrichment (AI Harness)
- **Problem**: Local search might lack context from recent external documentation.
- **Action**:
    - When a user asks a query, the `AIHarness` scans for URLs or concepts that might benefit from external context.
    - If detected, it triggers a `resolve-external-context` job.
    - The `do-web-doc-resolver` fetches compact markdown.
    - The LLM prompt is augmented with both local Orama results AND the resolved external markdown.

## 12.2 Entity Auto-Hydration
- **Problem**: Manually entering descriptions and claims for a new concept is slow.
- **Action**:
    - Add a "Source URL" field to the Entity creation form.
    - On save, trigger a background job to fetch content via `do-web-doc-resolver`.
    - Automatically populate the `description` field with the resolver's summary.
    - (Optional) Use an AI agent to extract potential `claims` from the resolved markdown and present them as "Pending Claims" for user approval.

## 12.3 CLI Sync Enhancement
- **Problem**: `sync` only works on local directories.
- **Action**:
    - Update `cli/index.ts` to support `sync <url>`.
    - Use the resolver to pull a clean version of the target page.
    - Map the resolved title/content to a new Entity in the local SQLite DB.

## 12.4 TRIZ Conflict Resolution Context
- **Problem**: TRIZ contradictions often involve external technical tradeoffs.
- **Action**:
    - When a user identifies a contradiction, allow them to attach "Research URLs".
    - Use the resolver to pull relevant technical specs or papers.
    - The AI agent analyzes the *resolved markdown* specifically for "contradiction signals" to suggest Inventive Principles.

## 12.5 Offline-Ready Caching
- **Problem**: External sources go offline or change.
- **Action**:
    - Store the output of every `do-web-doc-resolver` call in a `web_cache` table in SQLite.
    - Schema: `url (PK), content (Markdown), resolver_version, resolved_at`.
    - Prioritize cached content when offline, ensuring the studio remains functional.

## 12.6 Multi-Modal Ingestion (New)
- **Problem**: Knowledge is often locked in PDFs or complex document formats.
- **Action**:
    - Enable `Docling` support within the resolver skill.
    - Allow users to "Sync File" or "Sync URL" for PDF/DOCX.
    - Extract structured claims directly from technical documents.

## 12.7 Routing Memory & Circuit Breakers (New)
- **Problem**: Wasting tokens/bandwidth on slow or failing external sites.
- **Action**:
    - Implement a local `routing_memory` table.
    - Track success/failure rates for domains.
    - Automatically switch to "Fast/Free" mode for reliable domains and "Quality" mode for complex ones.
