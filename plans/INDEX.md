# Plans Index - do-knowledge-studio

**Generated**: 2026-04-23  
**Source**: Swarm analysis (6 agents) + GitHub template validation  
**Method**: Multi-agent swarm with handoff coordination

## Quick Reference

| Priority | Plan File | Description | Est. Effort |
|----------|-----------|-------------|------------|
| **P0** | [01-critical-fixes.md](01-critical-fixes.md) | ⚠️ Partial (Docs/Versions), ✅ Orama Fixed | 2-4h |
| **P1** | [10-implementation-audit.md](10-implementation-audit.md) | NEW: Gap analysis & wiring tasks | 12-16h |
| **P1** | [02-code-quality.md](02-code-quality.md) | Tests, deduplication, type safety, ErrorBoundaries | 8-10h |
| **P1** | [09-ui-style-alignment.md](09-ui-style-alignment.md) | Atmospheric UI, glassmorphism, multi-mode themes | 8-12h |
| **P2** | [03-core-implementation.md](03-core-implementation.md) | CLI architecture, real export, test coverage | 12-16h |
| **P3** | [04-feature-roadmap.md](04-feature-roadmap.md) | AI Harness, claim provenance, semantic search | 20-30h |
| P3 | [11-expansion-roadmap.md](11-expansion-roadmap.md) | NEW: Future features (P2P Sync, Synthesis) | 40-60h |
| **P3** | [12-doc-resolver-integration.md](12-doc-resolver-integration.md) | NEW: Using web-doc-resolver for RAG & Hydration | 8-12h |
| **P3** | [05-documentation-overhaul.md](05-documentation-overhaul.md) | README, PHASES.md, JSDoc, AGENTS.md | 6-8h |


## Extended Plans

| Plan File | Description |
|-----------|-------------|
| [10-implementation-audit.md](10-implementation-audit.md) | Detailed analysis of UI/Logic gaps |
| [11-expansion-roadmap.md](11-expansion-roadmap.md) | Long-term feature roadmap |
| [00-swamp-analysis-summary.md](00-swamp-analysis-summary.md) | Executive summary from swarm analysis |
| [06-llm-provider-system.md](06-llm-provider-system.md) | ✅ COMPLETED: OpenRouter + Kilo plugin system |
| [07-github-template-alignment.md](07-github-template-alignment.md) | Architecture validation from template |
| [09-ui-style-alignment.md](09-ui-style-alignment.md) | Atmospheric UI alignment (from ui-ux-skill) |
| [08-perplexity-removal.md](08-perplexity-removal.md) | ✅ COMPLETED: Deleted, use web doc resolver |

## Execution Order

```
P0: Critical Fixes (Do First)
    ├─ Fix version inconsistencies (README, CLI, CHANGELOG)
    ├─ Fix broken doc references (SKILLS.md/AVAILABLE_SKILLS.md → AVAILABLE_SKILLS.md)
    └─ ✅ Fixed: Orama `any` type and remove functionality
    ↓
P1: Implementation Audit & Wiring (NEW)
    ├─ Wire Graph Snapshots (Logic exists, UI missing wiring)
    ├─ Wire Claim Provenance (Logic exists, UI missing)
    ├─ Replace UI Export mocks with real logic
    └─ Connect AI Harness to LLM system
    ↓
P1: Code Quality
    ├─ Add repository tests (80% coverage)
    ├─ Extract duplicated search logic
    ├─ Replace double casts with Zod validation
    └─ Add granular ErrorBoundaries
```

## Dependency Graph

```
01-critical-fixes
    ↓
02-code-quality ← depends on: 01 complete
    ↓
03-core-implementation ← depends on: 02 partial (tests)
    ↓
04-feature-roadmap ← depends on: 03 (export for context), 06 (LLM providers)
05-documentation-overhaul ← can run parallel to 04
```

## Health Scores (From Swarm Analysis)

| Category | Score | Trend |
|----------|--------|-------|
| Architecture | 85/100 | ✅ Validated by github-template-ai-agents |
| Implementation Completeness | 60/100 | ⚠️ Critical gaps in AI/Export/CLI |
| Code Quality | 75/100 | ⚠️ `any` type, double casts |
| Documentation | 68/100 | ⚠️ Version inconsistencies, broken links |

## Key Constraints

1. **AGENTS.md is single source of truth** - Do NOT modify GEMINI.md or QWEN.md
2. **Local-first ONLY** - No required backend
3. **Strict TypeScript** - NO `any` (HARD RULE)
4. **Markdown is NOT canonical truth** - Use only for export/import
5. **Use web doc resolver or web researcher** - NOT perplexity (deleted)

## Completed Tasks

- [x] **LLM Provider System** (`src/lib/llm/`) - OpenRouter + Kilo Gateway
- [x] **Perplexity Removal** - Deleted all files, replaced with web doc resolver
- [x] **GitHub Template Alignment** - Architecture validated, no changes needed
- [x] **BATS Tests Fixed** - Removed merge conflict marker in quality_gate.sh
- [x] **opencode.json Created** - Resolves validate-skills.sh error

## Next Steps

1. **Start with P0** - Fix `any` type in `src/lib/search.ts`
2. **Run quality gates frequently** - `npm test`, `npm run lint`, `npm run typecheck`
3. **Use plans/ as checklist** - Mark tasks complete as you go
4. **Don't modify GEMINI.md/QWEN.md** - AGENTS.md is canonical

## Verification Commands

```bash
# Check all plans exist
ls -1 plans/*.md

# Verify perplexity removed
grep -r "perplexity" . --include="*.md"

# Run BATS tests
bats tests/*.bats

# Run quality gate
./scripts/quality_gate.sh --changed

# Run npm quality gates
npm test && npm run lint && npm run typecheck
```

---

**Swarm Coordination Notes**:
- 6 agents deployed for initial analysis
- 3 agents for perplexity deletion, plans update, coordination
- Handoff: explore → general (x3) → general (synthesis)
- Total estimated time saved: ~8 hours vs sequential execution
