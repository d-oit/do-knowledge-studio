# Plan 09: UI/UX Style Alignment (Atmospheric Interface)

**Priority**: P1 (Parallel to Code Quality)  
**Estimated Total Effort**: 8-12 hours  
**Sources**: Analyzed from `do-gemini-ui-ux-skill` repository.

## Goal
Align the `do-knowledge-studio` UI with the "Multi-Mode Atmospheric Interface" style, moving from a standard clean look to a high-fidelity, immersive experience.

## Tasks

### 9.1 Multi-Mode Design Tokens
**Files**: `src/styles/tokens.css`  
**Action**:
1. Implement 4 core theme modes using CSS variables and data attributes:
   - `[data-theme="app"]` (Default Dark)
   - `[data-theme="game"]` (Tactical Emerald)
   - `[data-theme="neural"]` (Cyber Indigo)
   - `[data-theme="technical"]` (High-Contrast Light)
2. Add atmospheric token set:
   - `--glass-blur: 80px`
   - `--glass-bg: rgba(255, 255, 255, 0.01)`
   - `--glass-border: rgba(255, 255, 255, 0.1)`
**Effort**: 2-3h

### 9.2 Atmospheric Typography
**Files**: `src/styles/index.css`, `public/fonts/`  
**Action**:
1. Add font imports (Google Fonts or local):
   - **Anton** (Display/H1)
   - **Georgia** (H2 - Italic)
   - **Inter** (Body)
   - **Courier New** (Mono)
2. Implement hierarchy rules:
   - H1: Anton, tracking-tighter, uppercase.
   - H2: Georgia, italic, serif.
   - Body: Inter, text-sm/base.
   - Data: Courier New, 12px.
**Effort**: 1-2h

### 9.3 Glassmorphism & Effects
**Files**: `src/styles/utilities.css`  
**Action**:
1. Create `.glass` utility:
   - `backdrop-filter: blur(80px)`
   - `background: var(--glass-bg)`
   - `border: 1px solid var(--glass-border)`
   - `box-shadow: 0 0 50px rgba(0,0,0,0.5)`
2. Add `.shimmer` effect for active states.
3. Apply `will-change-transform` for anti-flicker on animated elements.
**Effort**: 2-3h

### 9.4 Structural Alignment (Visible Borders)
**Files**: `src/styles/layout.css`, `src/components/layout/`  
**Action**:
1. Enforce 1px solid borders for all major containers.
2. Update `border-radius` to `32px` for App mode.
3. Implement "HUD Safe Zones" using consistent padding (`p-6` to `p-10`).
4. Ensure `overflow: hidden` on HTML and `overflow-y: auto` on body for iframe safety.
**Effort**: 2h

### 9.5 Mobile-First HUD Constraints
**Files**: `src/styles/layout.css`  
**Action**:
1. Implement relative width rules for HUDs on mobile (`w-[calc(100%-32px)]`).
2. Implement fixed widths for HUDs on desktop (`w-72`).
3. Ensure 44x44px minimum tap targets.
**Effort**: 1-2h

## Validation
- [x] UI renders correctly in all 4 modes.
- [x] Glassmorphism effects do not cause performance lag (check FPS).
- [x] Typography matches the Display/Serif/Sans/Mono hierarchy.
- [x] All major sections have visible 1px borders.
- [x] Layout is responsive from 375px to 1440px+.
