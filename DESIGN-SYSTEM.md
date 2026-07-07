# DO Knowledge Studio — Design System

A reference for the "Editorial Paper & Saffron" visual language used across the
DO Knowledge Studio. This document is the single source of truth for color
tokens, typography, spacing, components, and accessibility rules. All
implementation lives in `src/app/globals.css` and the studio components under
`src/components/studio/`.

---

## 1. Design philosophy

DO Knowledge Studio is a **local-first knowledge management app** — every byte
of the user's thinking stays in their browser unless they explicitly export it.
The visual language reflects that promise of a quiet, durable, personal
workspace.

**Editorial Paper & Saffron** borrows from print: a warm off-white "paper"
background, deep warm "ink" type, and a single saffron accent that directs the
eye to primary actions and active states. Headings use Newsreader — a serif with
a literary, considered feel — while body text uses Geist Sans for clarity at
small sizes. The result reads like a well-set journal that happens to be
interactive.

The system is intentionally restrained. Most surfaces are paper-toned; most
color is informational (entity types, status, semantic search) rather than
decorative. Saffron is reserved for the single most important action on a
screen. Borders and dividers are warm, never neutral grey. Shadows are subtle
and warm-tinted. The whole interface should feel like it could be printed on
uncoated stock and still make sense.

---

## 2. Color system

All tokens are defined in `:root` and overridden in `.dark`. Tailwind utility
classes (`bg-paper`, `text-ink`, `border-saffron`, etc.) are generated from the
mappings in `@theme inline`.

### 2.1 Surfaces and ink

| Token               | Light value | Dark value | Tailwind class          | Usage                                                |
|---------------------|-------------|------------|-------------------------|------------------------------------------------------|
| `--background`      | `#faf8f3`   | `#14110d`  | `bg-background`         | App background, warm paper                           |
| `--paper`           | `#faf8f3`   | `#14110d`  | `bg-paper`              | Alias for background, used in editorial contexts     |
| `--paper-raised`    | `#ffffff`   | `#1c1814`  | `bg-paper-raised`       | Cards, popovers, raised surfaces                     |
| `--surface-sunken`  | `#f1ede4`   | `#1a1612`  | `bg-surface-sunken`     | Inset / recessed panels, code blocks, wells          |
| `--card`            | `#ffffff`   | `#1c1814`  | `bg-card`               | shadcn/ui cards                                      |
| `--popover`         | `#ffffff`   | `#1c1814`  | `bg-popover`            | Popovers, command palette                            |
| `--sidebar`         | `#f3efe6`   | `#1a1612`  | `bg-sidebar`            | Sidebar surface                                      |
| `--muted`           | `#f1ede4`   | `#25201a`  | `bg-muted`              | Muted backgrounds, chip wells, code kbd chips        |
| `--foreground`      | `#1a1814`   | `#f2eee5`  | `text-foreground`       | Default text color                                   |
| `--ink`             | `#1a1814`   | `#f2eee5`  | `text-ink`              | Strongest headings, primary text                     |
| `--ink-soft`        | `#3a3530`   | `#d4cec0`  | `text-ink-soft`         | Body copy, nav item labels                           |
| `--ink-mute`        | `#6b6760`   | `#9b958a`  | `text-ink-mute`         | Secondary text, subtitles, metadata                  |
| `--ink-faint`       | `#9c978d`   | `#6e685e`  | `text-ink-faint`        | Tertiary text, placeholders, icons at rest           |

### 2.2 Primary, secondary, and saffron accents

| Token                  | Light value | Dark value | Tailwind class              | Usage                                                |
|------------------------|-------------|------------|-----------------------------|------------------------------------------------------|
| `--primary`            | `#1a1814`   | `#f2eee5`  | `bg-primary text-primary-foreground` | Solid "ink" buttons (primary CTA inverts in dark) |
| `--primary-foreground` | `#faf8f3`   | `#14110d`  | `text-primary-foreground`   | Text on primary buttons                              |
| `--secondary`          | `#f1ede4`   | `#25201a`  | `bg-secondary`              | Secondary buttons, subtle surface                    |
| `--accent`             | `#f5e8d5`   | `#2a2018`  | `bg-accent`                 | Saffron-tinted background for active nav, selection  |
| `--accent-foreground`  | `#6a3d12`   | `#e5944a`  | `text-accent-foreground`    | Text on accent surface                               |
| `--saffron`            | `#c77d3a`   | `#e5944a`  | `text-saffron bg-saffron`   | Primary brand accent — use sparingly for CTAs        |
| `--saffron-soft`       | `#f5e8d5`   | `#2a2018`  | `bg-saffron-soft`           | Soft saffron background (active nav, hover chips)    |
| `--saffron-deep`       | `#8a4f1c`   | `#f5b074`  | `text-saffron-deep`         | Deep saffron text on soft backgrounds                |
| `--saffron-hover`      | `#b36a2e`   | `#d4824a`  | `hover:bg-saffron-hover`    | Saffron button hover state                           |
| `--saffron-active`     | `#8a4f1c`   | `#b36a2e`  | `active:bg-saffron-active`  | Saffron button pressed/active state                  |

### 2.3 Supporting entity-type palette

Each entity type has a dedicated hue that propagates across the Library, Graph,
Mind Map, and right panel. Dots, badges, and selection tints all draw from the
same family.

| Token     | Light value | Dark value | Entity type | Tailwind classes (from `ENTITY_TYPE_META`)                          |
|-----------|-------------|------------|-------------|---------------------------------------------------------------------|
| `--sky`   | `#6b8aa8`   | `#8eaac7`  | note        | `bg-sky-100 dark:bg-sky-950/40`, `text-sky-700 dark:text-sky-300`   |
| `--saffron` | `#c77d3a` | `#e5944a`  | concept     | `bg-amber-100 dark:bg-amber-950/40`, `text-amber-700 dark:text-amber-300` |
| `--clay`  | `#b8593a`   | `#d4795a`  | person      | `bg-rose-100 dark:bg-rose-950/40`, `text-rose-700 dark:text-rose-300` |
| `--sage`  | `#5c7b6e`   | `#84a597`  | project     | `bg-emerald-100 dark:bg-emerald-950/40`, `text-emerald-700 dark:text-emerald-300` |

> Note: the dot/badge utilities use Tailwind's stock sky/amber/rose/emerald
> palettes for legibility, while the underlying `--sky` / `--saffron` / `--clay`
> / `--sage` tokens drive graph edges, chart series, and accent ramps so that
> the entity-type "identity" reads consistently.

### 2.4 Borders, inputs, focus, destructive

| Token           | Light value | Dark value | Usage                                              |
|-----------------|-------------|------------|----------------------------------------------------|
| `--border`      | `#e5e1d8`   | `#2b2620`  | Dividers, card borders, default button borders     |
| `--input`       | `#e5e1d8`   | `#2b2620`  | Input borders (alias of border)                    |
| `--ring`        | `#c77d3a`   | `#e5944a`  | Focus ring color (saffron)                         |
| `--destructive` | `#b91c1c`   | `#ef4444`  | Destructive actions (delete, remove)               |

### 2.5 Chart palette

| Token       | Light     | Dark      | Default role                    |
|-------------|-----------|-----------|---------------------------------|
| `--chart-1` | `#c77d3a` | `#e5944a` | Saffron (primary series)        |
| `--chart-2` | `#5c7b6e` | `#84a597` | Sage                            |
| `--chart-3` | `#6b8aa8` | `#8eaac7` | Sky                             |
| `--chart-4` | `#b8593a` | `#d4795a` | Clay                            |
| `--chart-5` | `#8a6d9c` | `#b395d1` | Plum (categorical fifth)        |

### 2.6 Layout tokens

| Token                | Value                                                                | Usage                                  |
|----------------------|----------------------------------------------------------------------|----------------------------------------|
| `--header-height`    | `4rem` (64px)                                                        | Topbar height                          |
| `--header-bg`        | `color-mix(in oklab, var(--background) 85%, transparent)`            | Frosted topbar background              |
| `--focus-ring-offset`| `2px`                                                                | Outline offset for `.focus-ring`       |
| `--radius`           | `0.625rem` (10px)                                                    | Base radius                            |

---

## 3. Typography

Three fonts, loaded via `next/font/google` in `src/app/layout.tsx` and surfaced
as CSS variables (`--font-geist-sans`, `--font-newsreader`, `--font-geist-mono`).

| Font       | CSS variable          | Role                                                        | Tailwind class |
|------------|-----------------------|-------------------------------------------------------------|----------------|
| Newsreader | `--font-newsreader`   | Headings, page titles, entity names, brand wordmark         | `font-serif`   |
| Geist Sans | `--font-geist-sans`   | Body copy, UI labels, buttons, nav, metadata                | `font-sans` (default) |
| Geist Mono | `--font-geist-mono`   | Keyboard hints (`⌘K`, `G H`), code, numeric IDs, timestamps | `font-mono`    |

### 3.1 Type scale

The scale is editorial — small jumps, generous leading on serif headings, tight
tracking on display sizes. Body copy default is 14px (`text-[13px]` to `text-sm`
depending on density).

| Class                  | Size     | Usage                                              |
|------------------------|----------|----------------------------------------------------|
| `text-[10px]`          | 10px     | Kbd hints, micro-labels, eyebrow text              |
| `text-[11px]`          | 11px     | Badges, status chips, sidebar footer text          |
| `text-[12px]`          | 12px     | Subtitles, button labels, secondary metadata       |
| `text-[13px]`          | 13px     | Body copy in dense UI (lists, nav, panels)         |
| `text-[14px]`          | 14px     | Body copy default, command palette input           |
| `text-[15px]`          | 15px     | Brand wordmark, prominent list items               |
| `text-base`            | 16px     | Editor body, large form labels                     |
| `text-lg`              | 18px     | Card titles, inspector entity name                 |
| `text-xl`              | 20px     | Topbar page title (desktop)                        |
| `text-2xl` – `text-4xl`| 24–36px  | Dashboard stats, empty-state headlines             |

### 3.2 Typographic utilities

| Class          | Effect                                                    |
|----------------|-----------------------------------------------------------|
| `.font-serif`  | Newsreader with stylistic sets `ss01`, `ss02` enabled     |
| `.text-balance`| `text-wrap: balance` — for headings up to ~3 lines        |
| `.text-pretty` | `text-wrap: pretty` — for body paragraphs                 |
| `.ink-rule`    | Adds a 1.75rem saffron underline beneath a heading        |
| `.truncate-2`  | Two-line clamp with ellipsis                              |
| `.truncate-3`  | Three-line clamp with ellipsis                            |

---

## 4. Spacing scale (4px grid)

All padding, margin, and gap values sit on a 4px grid. Half-steps (2px) are
allowed only for kbd chips and dot indicators.

| Class       | Value | Common use                                           |
|-------------|-------|------------------------------------------------------|
| `gap-0.5`   | 2px   | Dot-to-label spacing in chips                        |
| `gap-1`     | 4px   | Icon-to-text in micro-chips, kbd padding             |
| `gap-1.5`   | 6px   | Icon-to-text in buttons, badge internals             |
| `gap-2`     | 8px   | Default flex gap, nav item spacing                   |
| `gap-2.5`   | 10px  | Slightly roomier icon groups                         |
| `gap-3`     | 12px  | Card internal padding, topbar horizontal gap         |
| `gap-4`     | 16px  | Section spacing, card-to-card                        |
| `gap-5`     | 20px  | Page gutter on desktop                               |
| `gap-6`     | 24px  | View-level vertical rhythm                           |
| `gap-8`     | 32px  | Major section separation                             |

Page padding: `px-4 sm:px-6 lg:px-8` for most views. Topbar uses `px-3 sm:px-5`.

---

## 5. Radius scale

A single base radius (`--radius: 0.625rem` = 10px) drives the whole ramp via
calc(). Pill-shaped elements use `rounded-full`.

| Class            | Value          | Usage                                          |
|------------------|----------------|------------------------------------------------|
| `rounded-sm`     | 4px            | Tags, tight chips                              |
| `rounded-md`     | 6px (`--radius-sm`) | Buttons, inputs, list-item hover           |
| `rounded-lg`     | 8px (`--radius-md`) | Cards, panels                              |
| `rounded-xl`     | 10px (`--radius`)   | Modals, command palette                    |
| `rounded-2xl`    | 14px (`--radius-xl`)| Large cards, format tiles                  |
| `rounded-full`   | 999px          | Badges, dots, kbd chips, avatar                |

---

## 6. Shadows

Two warm-tinted elevation utilities. Use `.shadow-soft` for resting cards and
inputs; use `.shadow-lifted` for hover, popovers, and the command palette.
Avoid `shadow-2xl` outside of modals — the system prefers restraint.

| Class            | Value                                                                 |
|------------------|-----------------------------------------------------------------------|
| `.shadow-soft`   | `0 1px 2px rgba(26,24,20,0.04), 0 1px 3px rgba(26,24,20,0.06)`        |
| `.shadow-lifted` | `0 4px 12px rgba(26,24,20,0.08), 0 2px 4px rgba(26,24,20,0.04)`       |
| `shadow-sm`      | Tailwind default — used on the primary button only                    |
| `shadow-2xl`     | Tailwind default — reserved for command palette and modals            |

---

## 7. Focus ring convention

Every interactive element MUST apply the `.focus-ring` utility. The ring is a
saffron `outline` (2px solid `var(--ring)`) with a 2px offset, plus a
`border-radius: var(--radius-sm)` so the ring respects the element's shape. The
`:focus:not(:focus-visible)` rule suppresses the outline for mouse users while
keeping it for keyboard users.

```html
<!-- correct -->
<button class="rounded-md px-3 py-1.5 focus-ring">Save</button>
<input class="rounded-md border focus-ring" />

<!-- incorrect (no focus indicator) -->
<button class="rounded-md px-3 py-1.5">Save</button>
```

For inputs that already use a colored border on focus (e.g. the topbar inline
search), the saffron `focus:ring-2 focus:ring-saffron/40` may be used instead
of `.focus-ring` to avoid a double ring.

---

## 8. Component patterns

### 8.1 Header (topbar)

64px tall, `bg-background/80` with `backdrop-blur-sm`, bottom border. Layout is
a single flex row with `gap-2 sm:gap-3` and `px-3 sm:px-5`. Responsive rules:

| Viewport          | Visible elements                                                             |
|-------------------|------------------------------------------------------------------------------|
| < 768px (mobile)  | Mobile menu button, compact title (no subtitle), New entity (icon only)      |
| 768–1024px        | Title + subtitle, search icon button (opens palette), offline badge, "New"   |
| 1024–1100px       | Title + subtitle, inline search input, offline badge, "New"                  |
| ≥ 1100px (wide)   | Title + subtitle, inline search input, offline badge, "New entity"           |

The title column uses `min-w-0 flex-1 truncate` so it never pushes actions
off-screen. All action elements use `flex-shrink-0`. The inline search input is
`w-60` (240px), with a left search icon, a right `⌘K` kbd chip that opens the
command palette, and a saffron focus ring.

### 8.2 Sidebar

Fixed 248px (`w-[248px] shrink-0`), `bg-sidebar`, right border. Structure:
brand wordmark, search trigger, grouped nav, theme toggle + panel toggle in
footer. Active nav item uses `bg-saffron-soft text-saffron-deep` with saffron
icon; inactive items use `text-ink-soft hover:bg-sidebar-accent hover:text-ink`.
Each item shows its `G <key>` shortcut on hover at lg+.

### 8.3 Right panel

Fixed 320px (`w-[320px] shrink-0`), `bg-background`, left border. Renders one of
three contextual panels based on `currentView`:

- **SearchPanel** (default) — keyword/semantic mode tabs, search input bound to
  `searchQuery`, filtered entity list (top 20).
- **InspectorPanel** (Graph, Mind Map) — selected node metadata, tags,
  connections list, edit/delete actions.
- **CitationsPanel** (Chat, AI Harness) — numbered citation cards grounded in
  local entities.

### 8.4 Cards

`bg-card` (or `bg-paper-raised`), `border border-border`, `rounded-lg`,
optionally `.shadow-soft`. On hover, lift to `.shadow-lifted` and warm the
border (`hover:border-saffron/40`). Card titles use `font-serif text-lg`; card
metadata uses `text-[11px] text-ink-faint`.

### 8.5 Buttons

| Variant   | Classes                                                                                        | When to use                              |
|-----------|------------------------------------------------------------------------------------------------|------------------------------------------|
| Primary   | `bg-primary text-primary-foreground shadow-sm hover:opacity-90 focus-ring`                     | Single most important action on a screen |
| Saffron   | `bg-saffron text-white hover:bg-saffron-hover active:bg-saffron-active focus-ring`             | Brand-forward CTAs (sparingly)           |
| Secondary | `border border-border bg-background text-ink-soft hover:border-saffron/40 hover:text-ink focus-ring` | Cancel, secondary actions           |
| Ghost     | `text-ink-mute hover:bg-muted hover:text-ink focus-ring`                                       | Inline actions in toolbars               |
| Destructive | `border border-border text-ink-soft hover:border-red-300 hover:text-red-600 focus-ring`       | Delete, remove                           |

All buttons use `rounded-md`, `text-[12px] font-semibold` for primary labels,
`text-[12px] font-medium` for secondary. Icon-to-text gap is `gap-1.5`. Default
padding `px-3 py-1.5`; compact `px-2.5 py-1.5`.

### 8.6 Inputs

`rounded-md border border-border bg-background` with `text-[13px] text-ink
placeholder:text-ink-faint`. On focus: `focus:border-saffron focus:outline-none
focus:ring-2 focus:ring-saffron/40`. Icon-led inputs add `pl-9` and an
absolutely-positioned icon at `left-3 top-1/2 -translate-y-1/2`.

### 8.7 Chips and badges

| Pattern        | Classes                                                                                                |
|----------------|--------------------------------------------------------------------------------------------------------|
| Tag chip       | `rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-ink-mute`                             |
| Status dot     | `h-1.5 w-1.5 rounded-full bg-emerald-500` (paired with `text-[11px]` label)                           |
| Type label     | `rounded px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide text-ink-faint`                 |
| Kbd hint       | `rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-ink-faint`            |
| Lab badge      | `rounded-full border border-dashed border-saffron/40 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide text-saffron` |

### 8.8 Toasts

Sonner is mounted at `bottom-right` with `richColors closeButton`. Toasts use
the default Sonner styling but inherit the Geist Sans font. Use semantic types
(`toast.success`, `toast.error`, `toast.info`) so colors stay meaningful.

### 8.9 Empty states

A centered column with a faint Lucide icon (`text-ink-faint/50`, `h-8 w-8`), a
short headline (`text-[14px] font-medium text-ink`), and a one-line hint
(`text-[12px] text-ink-mute`). Primary CTAs in empty states use the Saffron or
Primary button variant.

---

## 9. Layout and breakpoints

### 9.1 Breakpoints

Tailwind defaults plus one custom 1100px step (`wide:`) used for the topbar's
"wide" treatment. Defined in `globals.css` as `--breakpoint-wide: 68.75rem`
inside its own `@theme` block (not `@theme inline`) so Tailwind v4 sorts it
correctly between `lg` and `xl`. Declaring custom breakpoints with `--breakpoint-*`
in a dedicated `@theme` block is required — arbitrary variants like
`min-[1100px]:` and `@theme inline` declarations both end up emitted BEFORE the
default `sm`/`md`/`lg` media queries, which breaks cascade order.

| Prefix            | Min width | Purpose                                                  |
|-------------------|-----------|----------------------------------------------------------|
| (none)            | 0         | Mobile baseline — single column, minimal chrome         |
| `sm:`             | 640px     | Large phone / small tablet — show subtitles              |
| `md:`             | 768px     | Tablet — show offline badge, search icon button          |
| `lg:`             | 1024px    | Small desktop — show inline search, right panel          |
| `wide:`           | 1100px    | Custom — full button labels in topbar                    |
| `xl:`             | 1280px    | Desktop — full chrome                                    |
| `2xl:`            | 1536px     | Large desktop                                            |

### 9.2 Three-column shell

```
+----------------+--------------------------+----------------+
|  Sidebar       |  Topbar                  |  Right panel   |
|  248px fixed   |  64px tall               |  320px fixed   |
|  shrink-0      +--------------------------+  shrink-0      |
|                |                          |                |
|                |  Main content (scroll)   |  Context panel |
|                |  flex-1, min-w-0         |  (scroll)      |
|                |                          |                |
+----------------+--------------------------+----------------+
```

The shell lives in `src/components/studio/app-shell.tsx`. The outer container is
`flex h-dvh w-full overflow-hidden`. The middle column is `flex min-w-0 flex-1
flex-col` so the main content can shrink without pushing the right panel off-
screen. The right panel is hidden below `lg` (`hidden lg:flex`).

---

## 10. Accessibility principles

1. **Visible focus.** Every interactive element uses `.focus-ring`. Focus is
   never removed via `outline: none` without a replacement.
2. **Reduced motion.** A `@media (prefers-reduced-motion: reduce)` block in
   `globals.css` disables the html theme transition and clamps all
   animation/transition durations to 0.01ms. Framer Motion animations should
   also check `useReducedMotion()` before running.
3. **Touch targets.** Interactive icons in toolbars and panels use `p-2`
   (16px), giving a 32px target. Primary actions in dense rows use `py-1.5`
   with adequate surrounding padding to approach the 44px minimum.
4. **Semantic HTML.** Use `<header>`, `<nav aria-label="Main navigation">`,
   `<main>`, `<aside>`, `<button>` (not `<div onClick>`). The topbar `<h1>` is
   the page title and updates with `currentView`.
5. **ARIA labels.** Icon-only buttons always have `aria-label`. The command
   palette sets `aria-label="Command palette"` and uses `role="dialog"` via
   cmdk.
6. **Color contrast.** Body copy (`--ink-soft` on `--background`) exceeds
   WCAG AA at 14px. Faint text (`--ink-faint`) is reserved for non-essential
   metadata and kbd hints.
7. **Keyboard navigation.** ⌘K opens the command palette globally, including
   when focus is inside an input (handled in `topbar.tsx` and
   `command-palette.tsx`). `Escape` closes the palette.
8. **Theme toggle.** `next-themes` toggles `.dark` on `<html>`. The transition
   is smoothed via `html { transition: background-color 200ms ease, color 200ms
   ease; }` and disabled under reduced motion.

---

## 11. References

- Tokens: `src/app/globals.css`
- Topbar (header): `src/components/studio/topbar.tsx`
- Sidebar: `src/components/studio/sidebar.tsx`
- Right panel: `src/components/studio/right-panel.tsx`
- Command palette: `src/components/studio/command-palette.tsx`
- App shell: `src/components/studio/app-shell.tsx`
- Entity type metadata: `src/lib/studio/types.ts`
- Zustand store: `src/lib/studio/store.ts`
