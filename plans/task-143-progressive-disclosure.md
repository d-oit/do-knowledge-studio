# Task Plan — #143: Progressive Disclosure

> **Issue**: design: introduce progressive disclosure across editor, graph, search, and AI flows
> **Priority**: P1 | **Depends on**: #144 (design system) ✅

## Goal

Hide complexity until the user is ready. Make first-use screens simpler while keeping power-user functionality discoverable.

## Current State

- **Editor.tsx**: Already has `showAdvanced` toggle with source URL and mention tool behind it ✅
- **SearchPanel.tsx**: Has filter chips + keyword/semantic toggle — needs refinement
- **GraphView.tsx**: Has focus mode, snapshots — controls could be better organized
- **AIHarness.tsx**: Needs review for progressive disclosure
- **Chat.tsx**: Needs review

## Implementation Plan

### 1. Editor — Improve Advanced Section
- [x] Already has expandable "Advanced" with ChevronDown/Right toggle
- [ ] Add tooltip/hint text explaining what Advanced contains
- [ ] Group related options (Source URL, Mention linking) under clear labels

### 2. Search — Progressive Filtering
- [x] Has filter chips (All, Entities, Claims, Notes, Projects, People)
- [x] Has keyword/semantic toggle
- [ ] Add "Advanced Search" collapsible for type-specific options
- [ ] Show simplified search initially (just keyword search bar)

### 3. Graph — Control Organization
- [x] Has focus mode, save/load snapshot, diff controls
- [ ] Group controls: Primary (Focus, Save) visible; Secondary (Load, Diff) behind "More"
- [ ] Add contextual help tooltips on hover

### 4. AI Harness — Guided Experience
- [ ] Add "Getting Started" empty state
- [ ] Show model selection behind "Advanced Settings" toggle
- [ ] Progressive prompt suggestions based on context

### 5. Chat — Simplified Initial State
- [ ] Show welcome message with capabilitiy overview on first open
- [ ] Keep input bar always visible and accessible

## Acceptance Criteria
- [ ] First-use screens are simpler
- [ ] Power-user functionality remains discoverable
- [ ] Advanced controls appear contextually when needed
- [ ] Onboarding friction reduced
