# Task Plan — #143: Progressive Disclosure

**Status**: COMPLETE (Plan 108 closes all deferred items, 2026-08-06)

> **Issue**: design: introduce progressive disclosure across editor, graph, search, and AI flows
> **Update (2026-08-05)**: The current-architecture first-use pass is implemented for Editor, Chat, and AI Harness. Graph snapshot history is not included because the current app stores one graph view snapshot rather than a snapshot collection; Search advanced filters remain future work.
> **Update (2026-08-06, Plan 108)**: All deferred items completed — Library advanced filters collapsible (tag + has-description), Graph "More" control grouping + contextual tooltips, AI Harness context-based prompt suggestions. E2E coverage extended to 4 viewports (mobile/tablet/desktop/desktop-xl). PR #613 CI fully green.
> **Priority**: P1 | **Depends on**: #144 (design system) ✅

## Goal

Hide complexity until the user is ready. Make first-use screens simpler while keeping power-user functionality discoverable.

## Current State

- **Editor.tsx**: Already has `showAdvanced` toggle with source URL and mention tool behind it ✅
- **SearchPanel.tsx**: Has filter chips + keyword/semantic toggle — advanced filters remain deferred
- **GraphView.tsx**: Has focus mode and one saved snapshot — control regrouping remains deferred
- **AIHarness.tsx**: Has a provider setup state; model controls are behind the existing settings disclosure ✅
- **Chat.tsx**: Has a local-first welcome/capability overview and always-visible input ✅

## Implementation Plan

### 1. Editor — Improve Advanced Section
- [x] Already has expandable "Advanced" with ChevronDown/Right toggle
- [x] Add hint text explaining what Advanced contains
- [x] Group related options under a clear Metadata & source heading

### 2. Search — Progressive Filtering
- [x] Has filter chips (All, Entities, Claims, Notes, Projects, People)
- [x] Has keyword/semantic toggle
- [x] Add "Advanced Search" collapsible for type-specific options (Plan 108: tag filter + has-description toggle behind "Advanced filters" disclosure)
- [x] Show simplified search initially (Plan 108: advanced options collapsed by default; keyword bar + quick chips remain the primary surface)

### 3. Graph — Control Organization
- [x] Has focus mode, save/load snapshot, diff controls
- [x] Group controls: Primary (Layout, Focus, Save) visible; Secondary (Undo, Redo, Export PNG) behind "More" (Plan 108; current view has no load/diff collection so Undo/Redo/Export take the secondary slot)
- [x] Add contextual help tooltips on hover (Plan 108: Tooltip on every toolbar button)

### 4. AI Harness — Guided Experience
- [x] Add "Getting Started" provider setup state
- [x] Show model selection behind the existing settings disclosure
- [x] Progressive prompt suggestions based on context (Plan 108: `buildContextSuggestions` — selected entity, library summary, connections, claims review)

### 5. Chat — Simplified Initial State
- [x] Show welcome message with capability overview on first open
- [x] Keep input bar always visible and accessible

## Acceptance Criteria

All criteria now satisfied across all five surfaces (Editor, Chat, AI Harness, Library search, Graph).

- [x] First-use screens are simpler
- [x] Power-user functionality remains discoverable
- [x] Advanced controls appear contextually when needed
- [x] Onboarding friction reduced
