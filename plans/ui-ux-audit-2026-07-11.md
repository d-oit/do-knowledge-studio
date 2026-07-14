# UI/UX Technical Audit — 2026-07-11

**Scope:** Current Next.js studio shell and all views under `src/components/studio/`  
**Standard:** WCAG 2.2 AA, responsive product UI, implementation performance, design-system consistency  
**Method:** Source inspection, targeted static searches, token contrast calculation, and implementation-pattern review  
**Limitation:** A live server was started successfully, but this environment has no browser automation CLI or Chromium installation. Responsive screenshots, computed layout, screen-reader behavior, and runtime focus order remain to be verified manually.

## Audit Health Score

| # | Dimension | Score | Key finding |
|---|-----------|------:|-------------|
| 1 | Accessibility | 1/4 | Core library and graph interactions are not keyboard operable; several fields and custom dialogs lack accessible contracts. |
| 2 | Performance | 2/4 | Broad Zustand subscriptions and graph lookups will make editing and visualization progressively less responsive. |
| 3 | Responsive design | 2/4 | A real mobile drawer exists, but controls are often below 44px and the full three-pane shell activates too early. |
| 4 | Theming | 3/4 | Semantic light/dark tokens are strong, but two text tokens fail AA and view code still introduces one-off colors. |
| 5 | Anti-patterns | 2/4 | The identity is recognizable, but the dashboard, cards, tiny labels, and repeated entrance effects are visibly template-driven. |
| **Total** | | **10/20** | **Acceptable — significant work needed** |

## Anti-pattern verdict

**Does it look AI-generated? Partially.** The Editorial Paper & Saffron direction, restrained radii, and Newsreader/Geist pairing give the product more identity than a generic AI dashboard. The home view weakens that advantage with the familiar hero-plus-four-metric-cards composition (`home-view.tsx:38-103`), repeated icon/card grids, pervasive tiny uppercase labels, and staggered reveal motion. These are not a reason to replace the visual system; they are a reason to let task content drive layout instead of repeating dashboard templates.

Named patterns found:

- **Hero-metric template:** four large-number cards immediately below a product statement.
- **Cardification:** bordered rounded containers are the default treatment for navigation targets, empty states, metrics, tips, and inspectors.
- **Tiny tracked eyebrow:** short uppercase labels recur across navigation groups, entity types, tips, status, and dialog sections.
- **Decorative entrance motion:** several task views animate in on load even though no state change is being communicated.
- **Control theater:** controls for semantic search, graph export, undo/redo, and zoom imply behavior that is absent or demo-only.

## Executive summary

- **Audit Health Score:** 10/20 (Acceptable)
- **Issues:** 0 P0, 7 P1, 5 P2, 1 P3
- **Strongest qualities:** distinctive editorial palette, complete dark token set, correct dynamic viewport shell, reduced-motion fallback, and a comparatively thoughtful mobile drawer.
- **Highest-value improvements:** make every core action keyboard operable, establish one accessible overlay primitive, repair contrast and target sizes, remove inert controls, then optimize store subscriptions and graph rendering.

## Detailed findings

### P1 — Major

#### 1. Core library and graph interactions are pointer-only

- **Location:** `src/components/studio/views/library-view.tsx:266-305`; `src/components/studio/views/graph-view.tsx:175-215`
- **Category:** Accessibility / Interaction
- **Impact:** Keyboard and switch-device users cannot open list-view entities or select graph nodes. The SVG exposes one image label, but individual nodes have no focus, role, name, or keyboard handler.
- **WCAG:** 2.1.1 Keyboard; 4.1.2 Name, Role, Value
- **Recommendation:** Put a real link or button inside each table row. Model graph nodes as keyboard-focusable controls with an accessible node list synchronized to visual selection; do not rely on `tabIndex` alone.
- **Suggested command:** `/impeccable harden library graph`

#### 2. Primary editor fields are unnamed and intentionally remove focus indication

- **Location:** `src/components/studio/views/editor-view.tsx:122-135`, `174-205`, `247-259`
- **Category:** Accessibility
- **Impact:** The entity name, description, tag input, and content editor depend on placeholder text for their names. Placeholders disappear during entry, and `focus:outline-none` leaves the main writing fields without a visible keyboard focus state. Tag removal and add buttons also lack accessible names.
- **WCAG:** 1.3.1 Info and Relationships; 2.4.7 Focus Visible; 2.5.8 Target Size; 3.3.2 Labels or Instructions
- **Recommendation:** Add persistent or visually hidden labels, label tag actions with the affected tag, and give borderless writing fields an inset/background focus treatment that preserves the editorial appearance.
- **Suggested command:** `/impeccable harden editor`

#### 3. Custom overlays do not share a complete dialog contract

- **Location:** `src/components/studio/views/export-view.tsx:287-365`, `368-410`; `src/components/studio/command-palette.tsx:109-170`; `src/components/studio/right-panel.tsx:225`; compare the stronger mobile drawer implementation at `src/components/studio/mobile-drawer.tsx:36-148`
- **Category:** Accessibility / UX
- **Impact:** Export dialogs do not declare dialog semantics, trap focus, restore focus, lock background interaction, or close on Escape. Overlay behavior varies by feature, increasing escape and focus-loss risk.
- **WCAG:** 2.1.2 No Keyboard Trap; 2.4.3 Focus Order; 4.1.2 Name, Role, Value
- **Recommendation:** Reuse one overlay/dialog primitive implementing labelled dialog semantics, initial focus, focus containment, Escape, focus restoration, scroll lock, and backdrop behavior. The mobile drawer already demonstrates most of the required behavior.
- **Suggested command:** `/impeccable harden overlays`

#### 4. Muted and accent color combinations fail text contrast

- **Location:** token definitions in `src/app/globals.css:79-149`; representative uses in `src/components/studio/right-panel.tsx:93-115`, `src/components/studio/views/library-view.tsx:190-210`, and `src/components/studio/mobile-drawer.tsx:173-175`
- **Category:** Accessibility / Theming
- **Impact:** Metadata, placeholders, badges, and status copy can be difficult to read, especially at the prevailing 9-11px sizes.
- **WCAG:** 1.4.3 Contrast (Minimum)
- **Verified ratios:**
  - `--ink-faint` `#9c978d` on paper `#faf8f3`: **2.74:1**
  - `--saffron` `#c77d3a` on paper: **3.08:1**
  - white on saffron: **3.27:1**
  - dark `--ink-faint` `#6e685e` on `#14110d`: **3.41:1**
- **Recommendation:** Reserve faint ink for non-text decoration, use `--ink-mute` for readable metadata, use saffron-deep for small text, and use ink rather than white on the light-theme saffron fill. Verify every semantic state in both themes.
- **Suggested command:** `/impeccable colorize accessibility states`

#### 5. Many touch targets are materially below 44×44px

- **Location:** topbar icons and primary action at `src/components/studio/topbar.tsx:60-73`, `100-124`; drawer tabs and close at `src/components/studio/mobile-drawer.tsx:177-184`, `199-231`; library view controls at `src/components/studio/views/library-view.tsx:110-155`; graph toolbar and zoom at `src/components/studio/views/graph-view.tsx:95-127`, `247-252`
- **Category:** Responsive / Accessibility
- **Impact:** Mobile and motor-impaired users must hit controls whose visual and clickable boxes are commonly about 32-36px, and some icon actions are smaller.
- **WCAG:** 2.5.8 Target Size (Minimum)
- **Recommendation:** Standardize control heights and icon-button hit areas to at least 44px on coarse pointers. Preserve compact desktop density with pointer-aware sizing rather than applying one size everywhere.
- **Suggested command:** `/impeccable adapt controls`

#### 6. Several controls promise behavior that is absent or demo-only

- **Location:** semantic search mode at `src/components/studio/right-panel.tsx:27-71` and `src/components/studio/mobile-drawer.tsx:302-330`; graph demo export and feedback-only undo/redo at `src/components/studio/views/graph-view.tsx:88-90`, `116-126`; inert zoom control at `src/components/studio/views/graph-view.tsx:247-252`
- **Category:** UX / Trust
- **Impact:** Changing Keyword/Semantic does not alter filtering, Undo/Redo only emits toasts, Export PNG announces a demo result, and Zoom has no handler. Users cannot distinguish shipped functionality from visual scaffolding.
- **Recommendation:** Implement each behavior or remove/disable it with direct explanatory copy. Never use success feedback for an operation that did not occur.
- **Suggested command:** `/impeccable harden graph search`

#### 7. The desktop three-pane layout activates at a tablet-width breakpoint

- **Location:** 248px sidebar at `src/components/studio/sidebar.tsx:70-75`; 320-340px right panels at `src/components/studio/right-panel.tsx:32-33`, `144-145`; both activate at `lg` (1024px)
- **Category:** Responsive / Information architecture
- **Impact:** At 1024px the fixed panels consume 568-588px before borders, leaving only about 436-456px for the primary task. Editor and visualization content become secondary to chrome precisely in the tablet landscape range.
- **Recommendation:** Keep the persistent sidebar at `lg`, but defer the right panel to a wider breakpoint or make it an on-demand drawer between tablet and wide desktop. Preserve contextual search with a visible trigger.
- **Suggested command:** `/impeccable adapt app shell`

### P2 — Minor

#### 8. Store subscriptions and graph rendering do unnecessary work

- **Location:** whole-store subscriptions in `src/components/studio/app-shell.tsx:22`, `src/components/studio/topbar.tsx:20-29`, `src/components/studio/views/graph-view.tsx:24-25`, and 13 other studio components; graph edge lookup at `src/components/studio/views/graph-view.tsx:141-143`
- **Category:** Performance
- **Impact:** Unrelated state changes can rerender large views. Graph drawing performs two linear node searches per edge, making the rendering path O(E×N). This conflicts with a local-first product expected to accumulate data over time.
- **Recommendation:** Use narrow Zustand selectors (with shallow comparison where appropriate) and build a memoized node-by-ID map before rendering edges. Profile typing, search, and graph selection with a realistically large local dataset.
- **Suggested command:** `/impeccable optimize studio rendering`

#### 9. Visual positions for new graph nodes are nondeterministic

- **Location:** `src/components/studio/views/graph-view.tsx:29-56`
- **Category:** UX / Performance
- **Impact:** `Math.random()` is used inside the entity-derived memo, so adding or editing an entity can move every unseeded node. The graph loses spatial memory and appears unstable.
- **Recommendation:** Persist positions or derive deterministic coordinates from stable entity IDs; update only the affected node when data changes.
- **Suggested command:** `/impeccable harden graph`

#### 10. Component vocabulary is fragmented

- **Location:** 89 raw `<button>` elements across `src/components/studio/`; repeated bespoke button and field classes in every view; arbitrary overlay z-indices at `src/components/studio/mobile-drawer.tsx:118-134`, `shortcuts-dialog.tsx:207`, `right-panel.tsx:225`, `export-view.tsx:289`, and `command-palette.tsx:112`
- **Category:** Consistency / Maintainability
- **Impact:** Focus, disabled, active, loading, target-size, and color behavior drift by screen. Layer order is encoded as unexplained values from 80 to 900.
- **Recommendation:** Introduce only the primitives that remove real repetition: Button/IconButton, Field, segmented control, and Dialog. Add semantic z-index tokens for drawer, backdrop, dialog, palette, toast, and tooltip.
- **Suggested command:** `/impeccable extract studio controls`

#### 11. Functional text is routinely too small

- **Location:** 124 occurrences of `text-[9px]`, `text-[10px]`, or `text-[11px]` across 17 of 20 studio TSX files; examples at `src/components/studio/views/ai-harness-view.tsx:114-118`, `src/components/studio/views/graph-view.tsx:161-168`, and `src/components/studio/right-panel.tsx:93-102`
- **Category:** Typography / Accessibility
- **Impact:** Metadata, graph labels, badges, hints, and sometimes functional state text become difficult to scan, especially with low-contrast faint ink and at browser zoom.
- **Recommendation:** Establish a 12px minimum for tertiary UI and 14px minimum for functional labels/body. Keep 10-11px only for short, nonessential metadata with AA contrast; eliminate 9px text.
- **Suggested command:** `/impeccable typeset studio`

#### 12. Segmented controls do not consistently expose state

- **Location:** right-panel search modes at `src/components/studio/right-panel.tsx:53-71`; editor edit/preview modes at `src/components/studio/views/editor-view.tsx:232-245`; graph layouts at `src/components/studio/views/graph-view.tsx:95-112`
- **Category:** Accessibility / Interaction
- **Impact:** Visual selection is not announced, and the controls alternate between tab-like navigation, toggles, and ordinary buttons without a consistent keyboard model.
- **WCAG:** 1.3.1 Info and Relationships; 4.1.2 Name, Role, Value
- **Recommendation:** Use tabs when panels switch, radio groups for one-of-many modes, and toggle buttons for independent state. Expose `aria-selected`, `aria-checked`, or `aria-pressed` accordingly.
- **Suggested command:** `/impeccable harden segmented controls`

### P3 — Polish

#### 13. The home view delays the task with dashboard ceremony

- **Location:** `src/components/studio/views/home-view.tsx:38-103`, `133-169`, `224-255`
- **Category:** Anti-pattern / Product UX
- **Impact:** A returning user first encounters a hero statement, four metric cards, and entrance animations before recent work. Most metrics are navigation disguised as analytics rather than decisions the user needs to make.
- **Recommendation:** Lead with recent work and a single capture action. Move compact counts into the library/graph contexts where they inform a task; retain only the one metric that changes what the user should do next.
- **Suggested command:** `/impeccable distill home`

## Systemic patterns

1. **Accessibility is strongest in newly considered shell code and weakest inside feature views.** Mobile drawer semantics, focus trapping, Escape, and cleanup are thoughtful, but editor, export, graph, and library controls do not consistently use the same standards.
2. **The design system is tokenized visually but not behaviorally.** Color and typography tokens exist; control state, sizing, overlay, and focus contracts do not.
3. **Compactness has become miniaturization.** Small type and small controls recur across almost every feature rather than being reserved for genuinely dense data.
4. **The interface sometimes ships prototypes as affordances.** Toast-only or state-only controls undermine trust more than an honestly unavailable feature would.
5. **The local-first scaling story needs explicit performance budgets.** Broad store subscriptions and quadratic graph work are easy to miss with seed data and increasingly visible with real personal libraries.

## Positive findings

- The Paper & Saffron visual direction is restrained, readable at primary text levels, and more distinctive than the standard purple/blue AI-tool palette.
- Light and dark theme tokens are both defined centrally in `src/app/globals.css`; feature colors largely use semantic Tailwind aliases.
- `h-dvh`, `min-w-0`, and overflow boundaries in `app-shell.tsx:25-51` form a sound responsive shell foundation.
- The mobile drawer handles Escape, focus containment, initial focus, resize cleanup, and modal semantics (`mobile-drawer.tsx:36-148`). This should become the behavioral reference for all overlays.
- The global reduced-motion rule in `globals.css:241-244` prevents most decorative animations from becoming a motion-accessibility blocker.
- Library empty states explain local persistence and offer a specific next action rather than generic “nothing here” copy (`library-view.tsx:159-206`).
- Several controls already have good accessible names and pressed states, especially library view-mode buttons and topbar icon buttons.

## Recommended execution order

1. **P1 `/impeccable harden library graph editor overlays`** — restore keyboard access, accessible names, focus visibility, and consistent dialog behavior.
2. **P1 `/impeccable colorize accessibility states`** — repair faint/accent contrast in both themes before adjusting typography.
3. **P1 `/impeccable adapt app shell controls`** — enforce coarse-pointer target sizes and change tablet right-panel behavior.
4. **P1 `/impeccable harden graph search`** — remove or implement every inert/demo control.
5. **P2 `/impeccable optimize studio rendering`** — narrow Zustand subscriptions and make graph rendering deterministic and indexed.
6. **P2 `/impeccable extract studio controls`** — consolidate behavior, not merely class names, after interaction contracts are agreed.
7. **P2 `/impeccable typeset studio`** — establish a readable compact type scale and remove 9px functional text.
8. **P3 `/impeccable distill home`** — put recent work before dashboard ceremony.
9. **Final `/impeccable polish`** — verify visual rhythm and state consistency after structural fixes.

## Required verification after fixes

- Automated axe scan plus manual keyboard-only traversal of every view.
- Screen-reader checks for editor fields, graph selection, dialogs, status updates, and segmented controls.
- 320px, 390px, 768px, 1024px, 1280px, and 1440px viewport checks in both themes.
- 200% text zoom and 400% browser zoom/reflow checks.
- Pointer target measurement on mobile/coarse-pointer emulation.
- React Profiler runs for editor typing, live filtering, drawer search, graph selection, and a graph with at least 1,000 nodes / representative edges.

You can implement these one at a time, all at once, or in any order. Re-run the audit after fixes to measure the score change.
