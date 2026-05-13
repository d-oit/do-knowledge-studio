# Plan 04: Feature Roadmap (P3)

**Priority**: P3 (Medium term)
**Estimated Total Effort**: 20-30 hours
**Sources**: Swarm analysis - new feature suggestions, LLM provider system

## Tasks

### 4.1 AI Harness Integration (Using LLM Provider Plugin)
**Files**: `src/features/ai/AIHarness.tsx`, `src/lib/llm/`
**Issue**: AI Harness is non-functional placeholder
**Action**:
1. Integrate LLM provider system (already implemented in `src/lib/llm/`):
   - Add provider selection dropdown (OpenRouter Free / Kilo Gateway Free)
   - Load config from `localStorage` using `loadConfig()`
2. Implement chat UI with streaming:
   - Use `chatStream()` from LLM provider
   - Display streaming responses with `ReadableStream`
3. Add Orama context augmentation:
   - Query Orama search with user input
   - Inject top 3 results as context in system prompt
4. Add TRIZ analysis features:
   - Contradiction matrix lookup
   - Inventive principles suggestions
**Effort**: 6-8h
**Dependencies**: 3.2 (export for context persistence), LLM provider system (done)
**Validation**: AI Harness responds to queries, uses local knowledge context

---

### 4.2 Claim Provenance & Verification Tracking
**Files**: `src/db/schema.sql`, `src/features/editor/`
**Issue**: No tracking of claim sources or verification status
**Action**:
1. Migrate `claims` table to add columns:
   ```sql
   ALTER TABLE claims ADD COLUMN source TEXT;
   ALTER TABLE claims ADD COLUMN verification_status TEXT DEFAULT 'unverified';
   ```
2. Update TipTap `ClaimExtension.ts` to add source/status annotations
3. Add UI controls in editor: source input, verification dropdown
4. Add filtering in graph view: show only verified claims
**Effort**: 3-4h
**Dependencies**: None
**Validation**: Claims can be created with source/status, graph filters work

---

### 4.3 Semantic Search with Embeddings
**Files**: `src/lib/search.ts`
**Issue**: Search is keyword-only (FTS5), no semantic understanding
**Action**:
1. Install `transformers.js` for browser-based embeddings
2. Add Orama vector search plugin: `@orama/plugin-vision` (or custom embedding)
3. Generate embeddings for entities/claims on save
4. Add semantic search mode toggle in `SearchPanel.tsx`
5. Show related entities/claims based on embedding similarity
**Effort**: 6-8h
**Dependencies**: None (independent of other features)
**Validation**: Semantic search returns relevant results beyond keyword matches

---

### 4.4 Knowledge Graph Snapshots & Diffing
**Files**: `src/features/graph/GraphView.tsx`, `src/db/`
**Issue**: No versioning for graph states
**Action**:
1. Add `graph_snapshots` table to schema:
   ```sql
   CREATE TABLE graph_snapshots (
     id TEXT PRIMARY KEY,
     nodes_json TEXT NOT NULL,
     edges_json TEXT NOT NULL,
     created_at TEXT NOT NULL
   );
   ```
2. Add "Save Snapshot" button in GraphControls.tsx
3. Implement snapshot comparison: diff nodes/edges between two snapshots
4. Add "Revert to Snapshot" functionality
**Effort**: 3-4h
**Dependencies**: None
**Validation**: Snapshots save/load correctly, diff shows changes

---

### 4.5 Mobile Gesture Support
**Files**: `src/features/graph/GraphView.tsx`, `src/features/mindmap/MindMapView.tsx`
**Issue**: No touch gestures for mobile users
**Action**:
1. Add touch gesture handlers for Sigma.js graph:
   - Pinch to zoom, drag to pan, tap to select
2. Add touch gestures for MindElixir:
   - Swipe to navigate, pinch to zoom
3. Test on mobile breakpoints (375px, 768px)
4. Ensure 44x44px tap targets (UI/UX guardrail)
**Effort**: 2-3h
**Dependencies**: None
**Validation**: Graph/mind map usable on mobile devices

---

## Feature Priority Order
1. AI Harness Integration (highest user value)
2. Claim Provenance (enhances core workflow)
3. Semantic Search (improves search experience)
4. Graph Snapshots (nice-to-have for power users)
5. Mobile Gestures (enhances mobile UX)

---

## Completion Criteria
- [ ] AI Harness is fully functional with streaming + Orama context
- [ ] Claims support source/verification tracking
- [ ] Semantic search mode available and working
- [ ] Graph snapshots can be saved/compared/reverted
- [ ] Mobile gestures work for graph and mind map
- [ ] All quality gates pass: `npm test`, `npm run lint`, `npm run typecheck`
