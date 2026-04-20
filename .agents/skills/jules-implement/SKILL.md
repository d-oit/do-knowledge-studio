---
name: jules-implement
description: >
  Repository-aware implementation agent that handles delta-based targeted research,
  code generation, and validation of Stitch-rendered designs.
---

# Jules Implement Skill

Implementation agent that bridges the gap between Stitch designs and production-ready code. Handles delta-based research to ensure 2026 best practices are applied without redundant searches.

## Triggers
- `/jules-design` (as follow-up to `stitch-design`)
- "implement stitch design"
- "verify UI implementation"

## Capabilities
- **Delta-Based Autoresearch**:
  - Compares new Stitch output against the previous design hash in `.jules/ui-search-state.json`.
  - Performs web/paper searches only for articles/papers newer than the date in `.jules/ui-search-last-run.txt`.
  - Focuses research on missing 2026 best practices (e.g., WCAG compliance for new component patterns).
- **Code Implementation**: Applies finalized Stitch-rendered code with repository-aware adjustments (e.g., Zod schemas, SQLite-WASM integration).
- **Validation & Testing**: Generates unit tests using the **Test Data Builder** pattern to validate the rendered UI.
- **PR Workflow**: Commits changes atomically (feat:, test:, chore:) and opens an atomic PR.

## Constraints
- Update `.jules/ui-search-last-run.txt` to the current date after every successful run.
- Update `.jules/ui-search-state.json` with the new design hash after acceptance.
- Prefer zero-copy / low-allocation implementations in frontend logic.
- Ensure no overlapping navigation across mobile → large desktop breakpoints.

## Integration
- Consumes output from `stitch-design`.
- Uses `testdata-builders` skill for test generation.
- Follows `atomic-commit` workflow for PR creation.
