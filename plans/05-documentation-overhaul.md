# Plan 05: Documentation Overhaul

**Priority**: P3 (Medium term)  
**Estimated Total Effort**: 6-8 hours  
**Sources**: Swarm analysis - documentation gaps, README improvements  
**Constraint**: AGENTS.md is single source of truth - do NOT modify GEMINI.md or QWEN.md

## Tasks

### 5.1 Update README.md Accuracy
**File**: `README.md`  
**Issue**: Overstated claims about AI Harness (placeholder), Export (simulated)  
**Action**:
1. Line 20: Change "production-ready AI agent harness" to "AI agent harness (placeholder)"
2. Line 31: Change "Static Site Export" to "Static Site Export (Simulated)"
3. Line 32: Change "Multi-Agent AI Harness" to "Multi-Agent AI Harness (Placeholder)"
4. Add Status section after line 22:
   ```markdown
   ## 🚧 Status
   This project is in active development. Features marked "(Placeholder)" or "(Simulated)" are not yet fully implemented. See [PHASES.md](PHASES.md) for progress tracking.
   ```
5. Fix broken relative links (lines 218-219) to absolute GitHub URLs:
   - `../../issues` → `https://github.com/d-oit/do-knowledge-studio/issues`
   - `../../discussions` → `https://github.com/d-oit/do-knowledge-studio/discussions`
**Effort**: 1-2h  
**Validation**: README accurately reflects implementation status

---

### 5.2 Expand PHASES.md
**File**: `PHASES.md`  
**Issue**: Only 17 lines, Phase 3 marked "In Progress" with all items checked  
**Action**:
1. Update Phase 3 status to "Complete" and add pending items:
   ```markdown
   ## Phase 3: Synthesis (Complete - 2026-04)
   - [x] Local RAG (Orama-based search)
   - [x] Bi-directional markdown sync (CLI Support)
   - [x] Export to static site (Simulated)
   - [ ] Real export implementation
   - [ ] AI Harness integration
   ```
2. Add Phase 4+ roadmap:
   ```markdown
   ## Phase 4: Intelligence (Planned - 2026-Q3)
   - [ ] Semantic search with embeddings
   - [ ] Claim provenance tracking
   - [ ] Advanced TRIZ analysis features
   
   ## Phase 5: Collaboration (Planned - 2026-Q4)
   - [ ] Real-time sync (optional)
   - [ ] Multi-user support
   ```
3. Add target dates and links to GitHub milestones
**Effort**: 1h  
**Validation**: PHASES.md accurately reflects project progress and roadmap

---

### 5.3 Improve JSDoc Coverage
**Files**: All `src/` files  
**Issue**: ~30% JSDoc coverage for exported functions  
**Action**:
1. Add JSDoc to all exported functions in:
   - `src/db/client.ts`: `initDb()`, `getDb()`
   - `src/db/repository.ts`: All CRUD operations
   - `src/lib/search.ts`: `initSearch()`, `upsertToSearchIndex()`
   - `src/features/**/*.tsx`: React component props and handlers
2. Include `@param`, `@returns`, `@throws` tags where applicable
3. Target: 80%+ coverage for exported items
**Effort**: 3-4h  
**Validation**: `npm run lint` passes with no JSDoc warnings

---

### 5.4 Fix AGENTS.md Skills List
**File**: `AGENTS.md`  
**Issue**: Two skills lists (lines 35-40 and 46-100) that don't match  
**Action**:
1. Consolidate to single skills list (use the comprehensive table at lines 46-100)
2. Remove redundant skills section at lines 35-40
3. Fix truncated table descriptions (ensure full text displays)
4. Verify all skills in table have corresponding `.agents/skills/` directories
**Effort**: 1h  
**Validation**: AGENTS.md has single, accurate skills list

---

### 5.5 Add Status Badges to README
**File**: `README.md`  
**Issue**: No visual indicator of project status  
**Action**:
1. Add status badge after line 10:
   ```markdown
   [![Status](https://img.shields.io/badge/status-alpha-orange)](PHASES.md)
   ```
2. Add placeholder emoji (🚧) for WIP features in Features section
**Effort**: 15min  
**Validation**: Badges render correctly on GitHub

---

### 5.6 Verify GitHub Template Alignment
**Reference**: [github-template-ai-agents](https://github.com/d-o-hub/github-template-ai-agents)  
**Issue**: Ensure our `.agents/` structure, `AGENTS.md`, and skill symlinks match the proven template  
**Action**:
1. Cross-check agent structure (Claude, Gemini, Qwen, OpenCode, Cursor, Windsurf) against template specs
2. Validate skills are stored in `.agents/skills/` with proper symlinks
3. Confirm AGENTS.md is the single source of truth per template requirements
4. Document alignment in plan 07; no structural changes required  
**Effort**: 30min  
**Validation**: Architecture matches template best practices; plan 07 updated

---

## Documentation Principles
1. **AGENTS.md is single source of truth** - all agent-related docs must align with it
2. **GEMINI.md and QWEN.md are not to be modified** - they are redundant if AGENTS.md is canonical
3. **Accuracy over completeness** - better to mark features as WIP than overstate implementation
4. **Local-first emphasis** - document hard rules and constraints clearly

---

## Completion Criteria
- [ ] README.md accurately reflects implementation status with no overstated claims
- [ ] PHASES.md includes Phase 4+ roadmap with target dates
- [ ] JSDoc coverage ≥80% for exported functions
- [ ] AGENTS.md has single, consistent skills list
- [ ] Status badges added to README
- [ ] All quality gates pass: `npm test`, `npm run lint`, `npm run typecheck`
