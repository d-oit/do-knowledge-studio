# ADR 001: SQLite over Markdown as Truth

## Status
Superseded by ADR 018 (Next.js Architecture Baseline) and ADR 028 (Validated Local Data Boundaries). The project now uses Zustand + localStorage as the canonical persistence layer, not SQLite WASM.

## Context
Standard knowledge tools use Markdown files as the canonical truth. This makes multi-dimensional queries (e.g., "all claims with confidence > 0.8 about Entity X") slow and error-prone.

## Decision
We use SQLite WASM as the primary store. Markdown is a derivative format for export/portability.

## Consequences
- Better data integrity.
- Fast relational queries.
- Requires robust backup/export tools (implemented in CLI).
