# Visual Validation Checklist

## Purpose

Prevent wrong visual output by validating every component against the design system before shipping. Run this checklist after any UI change.

## Checklist

### 1. Dark Mode Audit

Search for hardcoded colors that don't adapt:

```bash
# Find hardcoded white/black
grep -rn "bg-white\|bg-black\|text-white\|text-black" src/components/

# Find hardcoded hex
grep -rn "bg-\[#[0-9a-f]\|text-\[#[0-9a-f]" src/components/
```

**Rules:**
- Never use `bg-white` — use `bg-background` or `bg-paper-raised`
- Never use `bg-black` — use `bg-ink` or `bg-background`
- Never use `text-white` on colored backgrounds — use `text-primary-foreground` or `text-white` only on brand colors (saffron, emerald, rose)
- Always test both themes: toggle dark mode and check every changed component

### 2. Component State Audit

Every interactive element must have these states:

| State | Class | Example |
|-------|-------|---------|
| Default | (none) | Resting appearance |
| Hover | `hover:*` | Color, shadow, or scale change |
| Focus | `focus-ring` | 2px saffron outline |
| Active | `press-scale` | Scale down to 0.97 |
| Disabled | `disabled:opacity-40 disabled:cursor-not-allowed` | Grayed out |
| Loading | `disabled` + spinner | Prevents double-submit |

### 3. Toggle/Switch Audit

```bash
# Find toggle components
grep -rn "role=\"switch\"\|role=\"checkbox\"" src/components/
```

**Rules:**
- Track: use `bg-saffron` (on) / `bg-border` (off) — never hardcoded colors
- Knob: use `bg-background` — never `bg-white`
- Knob position: `translate-x-4` (on) / `translate-x-0.5` (off)
- Must have `aria-checked` attribute

### 4. Spacing Audit

```bash
# Find irregular spacing
grep -rn "gap-[0-9]\|px-[0-9]\|py-[0-9]" src/components/ | grep -v "gap-0\.\|gap-1\|gap-1\.5\|gap-2\|gap-2\.5\|gap-3\|gap-4\|gap-5\|gap-6\|gap-8"
```

**Rules:**
- Use the 4px grid: 0.5 (2px), 1 (4px), 1.5 (6px), 2 (8px), 2.5 (10px), 3 (12px), 4 (16px), 5 (20px), 6 (24px), 8 (32px)
- No arbitrary values like `gap-[13px]` or `px-[7px]`

### 5. Typography Audit

```bash
# Find inconsistent text sizes
grep -rn "text-\[" src/components/ | grep -o "text-\[[0-9]*px\]" | sort | uniq -c | sort -rn
```

**Rules:**
- Standard sizes: 10px (badges), 11px (metadata), 12px (labels), 13px (body), 14px (headings), 15px (serif titles)
- Headings use `font-serif` (Newsreader)
- Body uses `font-sans` (Geist Sans)
- Code/kbd uses `font-mono` (Geist Mono)

### 6. Focus Ring Audit

```bash
# Find buttons/inputs without focus-ring
grep -rn "className.*rounded-md.*px.*py" src/components/ | grep -v focus-ring | grep -v "focus:border\|focus:ring"
```

**Rules:**
- Every `<button>` must have `focus-ring`
- Every `<input>` and `<textarea>` must have `focus:border-saffron focus:ring-2 focus:ring-saffron/40`
- Never remove focus without replacement

### 7. Touch Target Audit

**Rules:**
- Minimum 44×44px for all interactive elements
- Use `p-2` (16px padding) on icon buttons for 32px icon + 16px padding = 48px target
- Use `px-3 py-1.5` or larger on text buttons

### 8. Animation Audit

```bash
# Find bounce/elastic easing
grep -rn "bounce\|elastic\|spring" src/
```

**Rules:**
- Never use bounce or elastic easing
- Use `ease-out-quart` or `ease-out-expo` for natural deceleration
- Respect `prefers-reduced-motion`

## Pre-Ship Checklist

Before merging any UI PR:

- [ ] Toggle dark mode — all changed components look correct
- [ ] Check all interactive states (hover, focus, active, disabled)
- [ ] Verify focus ring visible on all buttons/inputs
- [ ] Check at mobile (375px), tablet (768px), desktop (1280px)
- [ ] Run `grep -rn "bg-white\|bg-black" src/components/` — no hits
- [ ] Run `grep -rn "focus-ring" src/components/` — all buttons covered
- [ ] Test with `prefers-reduced-motion: reduce` — no jarring animations
