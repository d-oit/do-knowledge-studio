---
version: "1.0.0"
name: document-rendering-and-locators
description: >
  Implement resilient document rendering and annotation anchoring. Activate for reader-core, TOC, locator, or highlight anchoring changes. Generic pattern applicable to EPUB, PDF, or any document format.
category: workflow
---

# Document Rendering and Locators

Purpose: implement resilient document rendering, locator extraction, and annotation anchoring.

## When to run
- Integrating document rendering library or reader-core changes.
- Working on TOC, locator, or highlight/comment anchoring logic.
- Debugging annotation drift or document loading regressions.

## Workflow
1. **Define data model** -- confirm multi-signal locator requirements (position + text + chapter + DOM fallback).
2. **Design anchors** -- map DOM selections --> `{ position, selectedText, chapterRef, elementIndex, charOffset }`.
3. **Implement** -- use rendering library APIs for annotations and navigation, ensure async cleanup.
4. **Resilience** -- add re-anchoring strategy (exact match --> fuzzy text --> chapter fallback --> user notice).
5. **Performance** -- lazy-load document assets, reuse single rendition, clean up listeners to avoid leaks.
6. **Testing** -- add test cases for locator serialization + re-anchor helpers; capture regressions.

## Checklist
- [ ] Position + text excerpt + chapterRef persisted together.
- [ ] Anchor serialization uses stable casing + schema.
- [ ] Re-anchoring warns user when falling back.
- [ ] Event handlers removed on unmount.
- [ ] Telemetry events logged for load failures with trace IDs.

## References
- `references/locator-patterns.md` - Document locator strategies
- `references/anchoring.md` - Annotation anchoring techniques
