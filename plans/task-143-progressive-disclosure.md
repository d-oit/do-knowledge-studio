# Task Plan — #143: Progressive Disclosure

**Status**: PARTIALLY COMPLETE (current-architecture UX pass, 2026-08-05)

> **Issue**: design: introduce progressive disclosure across editor, graph, search, and AI flows
> **Update (2026-08-05)**: The current-architecture first-use pass is implemented for Editor, Chat, and AI Harness. Graph snapshot history is not included because the current app stores one graph view snapshot rather than a snapshot collection; Search advanced filters remain future work.
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
- [ ] Add "Advanced Search" collapsible for type-specific options (deferred)
- [ ] Show simplified search initially (just keyword search bar) (deferred)

### 3. Graph — Control Organization
- [x] Has focus mode, save/load snapshot, diff controls
- [ ] Group controls: Primary (Focus, Save) visible; Secondary (Load, Diff) behind "More" (deferred; current view has no load/diff collection)
- [ ] Add contextual help tooltips on hover (deferred)

### 4. AI Harness — Guided Experience
- [x] Add "Getting Started" provider setup state
- [x] Show model selection behind the existing settings disclosure
- [ ] Progressive prompt suggestions based on context (deferred)

### 5. Chat — Simplified Initial State
- [x] Show welcome message with capability overview on first open
- [x] Keep input bar always visible and accessible

## Acceptance Criteria

The current-architecture pass satisfies these criteria for the Editor, Chat, and AI Harness surfaces; Search advanced filters and Graph control regrouping remain deferred.

- [x] First-use screens are simpler
- [x] Power-user functionality remains discoverable
- [x] Advanced controls appear contextually when needed
- [x] Onboarding friction reduced
