name

DO Knowledge Studio

description

Editorial Paper and Saffron. Warm off-white paper ground, deep warm ink type, and a single saffron accent that directs the eye to primary actions. Headings use Newsreader serif for a literary, considered feel; body uses Geist Sans for clarity. Restrained, durable, personal — like a well-set journal that happens to be interactive.

colors

paper
paper-raised
surface-sunken
ink
ink-soft
ink-mute
ink-faint
saffron
saffron-soft
saffron-deep
saffron-hover
saffron-active
sky
clay
sage
border
ring
destructive
background
foreground
primary
primary-foreground
secondary
secondary-foreground
muted
muted-foreground
accent
accent-foreground
card
card-foreground
popover
popover-foreground
sidebar
sidebar-foreground
sidebar-primary
sidebar-primary-foreground
sidebar-accent
sidebar-accent-foreground
sidebar-border
sidebar-ring

oklch(97.5% 0.008 85)
oklch(100% 0 0)
oklch(94.5% 0.012 85)
oklch(10.5% 0.008 70)
oklch(22% 0.006 70)
oklch(42% 0.005 70)
oklch(61% 0.004 70)
oklch(55% 0.145 55)
oklch(92% 0.025 70)
oklch(35% 0.12 50)
oklch(48% 0.14 50)
oklch(35% 0.12 50)
oklch(52% 0.06 230)
oklch(50% 0.12 35)
oklch(45% 0.08 160)
oklch(90% 0.006 85)
oklch(55% 0.145 55)
oklch(40% 0.14 25)
oklch(97.5% 0.008 85)
oklch(10.5% 0.008 70)
oklch(10.5% 0.008 70)
oklch(97.5% 0.008 85)
oklch(55% 0.06 230)
oklch(97.5% 0.008 85)
oklch(42% 0.005 70)
oklch(92% 0.01 85)
oklch(10.5% 0.008 70)
oklch(55% 0.145 55)
oklch(97.5% 0.008 85)
oklch(94% 0.01 85)
oklch(10.5% 0.008 70)
oklch(55% 0.145 55)
oklch(97.5% 0.008 85)
oklch(92% 0.008 85)
oklch(55% 0.145 55)

typography

wordmark

fontFamily

Newsreader, Georgia, serif

fontSize

1.1rem

fontWeight

600

letterSpacing

-0.01em

lineHeight

1.2

display

fontFamily

Newsreader, Georgia, serif

fontSize

clamp(1.8rem, 3vw, 2.4rem)

fontWeight

600

letterSpacing

-0.02em

lineHeight

1.15

headline

fontFamily

Newsreader, Georgia, serif

fontSize

clamp(1.4rem, 2.5vw, 1.8rem)

fontWeight

600

letterSpacing

-0.01em

lineHeight

1.25

title

fontFamily

Geist Sans, system-ui, sans-serif

fontSize

1rem

fontWeight

600

letterSpacing

0

lineHeight

1.4

body

fontFamily

Geist Sans, system-ui, sans-serif

fontSize

0.875rem

fontWeight

400

letterSpacing

0

lineHeight

1.6

mono

fontFamily

Geist Mono, monospace

fontSize

0.75rem

fontWeight

500

letterSpacing

0.02em

lineHeight

1.5

spacing

xs

sm

md

lg

xl

2xl

3xl

4px

8px

12px

16px

24px

32px

48px

64px

rounded

none

xs

sm

md

lg

xl

2xl

pill

0

2px

4px

6px

10px

12px

14px

999px

components

button-primary

button-secondary

button-ghost

input

card

nav-link

nav-link-active

chip

badge

kbd

backgroundColor

oklch(10.5% 0.008 70)

oklch(97.5% 0.008 85)

transparent

oklch(97.5% 0.008 85)

oklch(100% 0 0)

oklch(94% 0.01 85)

oklch(92% 0.025 70)

oklch(94% 0.01 85)

oklch(92% 0.025 70)

oklch(94% 0.01 85)

textColor

oklch(97.5% 0.008 85)

oklch(42% 0.005 70)

oklch(42% 0.005 70)

oklch(10.5% 0.008 70)

oklch(10.5% 0.008 70)

oklch(42% 0.005 70)

oklch(55% 0.145 55)

oklch(42% 0.005 70)

oklch(55% 0.145 55)

oklch(42% 0.005 70)

borderColor

oklch(90% 0.006 85)

oklch(90% 0.006 85)

oklch(90% 0.006 85)

oklch(55% 0.145 55)

oklch(90% 0.006 85)

oklch(55% 0.145 55)

rounded

rounded-md

rounded-md

rounded-md

rounded-md

rounded-lg

rounded-full

rounded-full

rounded-full

rounded-full

rounded

padding

px-3 py-1.5

px-3 py-1.5

px-3 py-1.5

px-3 py-1.5

p-4

px-3 py-2

px-3 py-2

px-2 py-0.5

px-2 py-0.5

px-1.5 py-0.5

# Design System: DO Knowledge Studio

## 1. Overview: Editorial Paper & Saffron

**Creative North Star: "Editorial Paper & Saffron"**

DO Knowledge Studio is a local-first knowledge management app. Every byte of the user's thinking stays in their browser unless they explicitly export it. The visual language reflects that promise of a quiet, durable, personal workspace.

Editorial Paper & Saffron borrows from print: a warm off-white paper background, deep warm ink type, and a single saffron accent that directs the eye to primary actions and active states. Headings use Newsreader — a serif with a literary, considered feel — while body text uses Geist Sans for clarity at small sizes. The result reads like a well-set journal that happens to be interactive.

**Key characteristics**

- Warm paper surfaces, never pure white or pure black.
- Saffron as the single primary accent, used sparingly for CTAs and active states.
- Deep warm ink for text, with soft and muted variants for hierarchy.
- Newsreader serif for headings and brand moments; Geist Sans for everything else.
- Warm-tinted borders and shadows, never neutral grey.
- Editorial restraint: most surfaces are paper-toned; color is informational, not decorative.

## 2. Kit: Component Vocabulary

When building new components, reach for these patterns before inventing new ones.

### Buttons

- **Primary**: dark ink fill, light paper text, for the single most important action on a screen
- **Secondary**: paper background, ink text, warm border, for secondary actions
- **Ghost**: transparent, ink-mute text, for inline toolbar actions
- **Saffron**: saffron fill, white text, for brand-forward CTAs (use sparingly)

### Cards

- Paper-raised background, warm border, small radius
- Resting: soft shadow; hover: lifted shadow with saffron border tint
- Titles use Newsreader serif; metadata uses small muted text

### Inputs

- Paper background, warm border, small radius
- Focus: saffron border with saffron ring
- Placeholder text uses ink-faint

### Navigation

- Sidebar: fixed width, paper background, grouped nav items
- Active item: saffron-soft background, saffron-deep text
- Inactive: ink-soft text, hover lifts to sidebar-accent

### Chips and Badges

- Rounded-full, muted background, small text
- Status dots: colored circles paired with labels
- Kbd hints: muted background, mono font, small text

## 3. Colors: Paper, Ink, Saffron

### Ground and Surface

- **Paper** (`oklch(97.5% 0.008 85)`): Default page background. Warm off-white.
- **Paper Raised** (`oklch(100% 0 0)`): Cards, popovers, raised surfaces.
- **Surface Sunken** (`oklch(94.5% 0.012 85)`): Inset panels, code blocks, wells.

### Ink (Text)

- **Ink** (`oklch(10.5% 0.008 70)`): Strongest headings, primary text.
- **Ink Soft** (`oklch(22% 0.006 70)`): Body copy, nav labels.
- **Ink Mute** (`oklch(42% 0.005 70)`): Secondary text, subtitles, metadata.
- **Ink Faint** (`oklch(61% 0.004 70)`): Tertiary text, placeholders.

### Saffron (Accent)

- **Saffron** (`oklch(55% 0.145 55)`): Primary accent. CTAs, focus rings, active states.
- **Saffron Soft** (`oklch(92% 0.025 70)`): Soft background for active nav, hover chips.
- **Saffron Deep** (`oklch(35% 0.12 50)`): Deep text on soft backgrounds.
- **Saffron Hover** (`oklch(48% 0.14 50)`): Button hover state.
- **Saffron Active** (`oklch(35% 0.12 50)`): Button pressed state.

### Entity Types

- **Sky** (`oklch(52% 0.06 230)`): Note entities
- **Saffron** (`oklch(55% 0.145 55)`): Concept entities
- **Clay** (`oklch(50% 0.12 35)`): Person entities
- **Sage** (`oklch(45% 0.08 160)`): Project entities

### Borders and Focus

- **Border** (`oklch(90% 0.006 85)`): Warm dividers, card borders
- **Ring** (`oklch(55% 0.145 55)`): Focus ring color (saffron)
- **Destructive** (`oklch(40% 0.14 25)`): Delete, remove actions

### Color Rules

**The Saffron Carries Brand Rule.** Saffron is the primary brand signal. If a single accent must represent DO Knowledge Studio, use saffron.

**The One Accent Rule.** Saffron is the only decorative accent. All other color is informational (entity types, status, charts).

**The Warm Border Rule.** Borders and dividers are always warm (`--border`), never neutral grey.

**The Paper Ground Rule.** Surfaces are paper-toned in light mode, dark ink in dark mode. Never pure white or pure black.

## 4. Typography: Serif Headings, Sans Body

**Display font:** Newsreader, Georgia, serif (headings, brand wordmark)
**Body font:** Geist Sans, system-ui, sans-serif (UI, body copy, labels)
**Mono font:** Geist Mono, monospace (kbd hints, code, timestamps)

### Hierarchy

- **Wordmark**: Newsreader, 1.1rem, weight 600, letter-spacing -0.01em. Brand lockup only.
- **Display h1**: Newsreader, clamp(1.8rem, 3vw, 2.4rem), weight 600, line-height 1.15. Hero and major statements.
- **Headline h2**: Newsreader, clamp(1.4rem, 2.5vw, 1.8rem), weight 600, line-height 1.25. Section titles.
- **Title h3**: Geist Sans, 1rem, weight 600, line-height 1.4. Component and panel headings.
- **Body**: Geist Sans, 0.875rem, weight 400, line-height 1.6. Long copy on paper surfaces.
- **Mono**: Geist Mono, 0.75rem, weight 500, letter-spacing 0.02em. Kbd hints, code, timestamps.

### Typography Rules

**The Serif-Headings Rule.** All headings use Newsreader serif. This is the core of the editorial identity. Do not use a sans-serif for headings.

**The Ink Needs Air Rule.** Body text on paper uses line-height 1.6 and a max width of 65-75ch.

**The Small Text Rule.** Body copy defaults to 14px (0.875rem). Smaller sizes (10-12px) are for metadata, badges, and kbd hints only.

**The Tracked Labels Are Short Rule.** Tracked uppercase labels are for short system markers. Do not write full sentences in tracked caps.

## 5. Elevation and Material

The system is mostly flat. Depth comes from subtle warm-tinted shadows and border contrast.

### Shadow Vocabulary

- **Soft** (`0 1px 2px rgba(26,24,20,0.04), 0 1px 3px rgba(26,24,20,0.06)`): Resting cards and inputs.
- **Lifted** (`0 4px 12px rgba(26,24,20,0.08), 0 2px 4px rgba(26,24,20,0.04)`): Hover states, popovers, command palette.
- **No heavy shadows**: The system prefers restraint. Avoid `shadow-2xl` outside modals.

### Material Rules

**Hairline First Rule.** Use 1px warm borders before adding shadow.

**No Glass Rule.** Translucency exists only in the frosted topbar (`backdrop-blur-sm`). No decorative glassmorphism.

**Warm Tint Rule.** All shadows use warm rgba tones (`rgba(26,24,20,...)`), never cool grey.

## 6. Components

### Header (Topbar)

64px tall, paper background at 85% opacity with backdrop blur, bottom border. Single flex row layout. Responsive visibility: mobile menu and search icons below lg, inline search at lg+, full button labels at wide (1100px+).

### Sidebar

Fixed 248px, paper background, right border. Brand wordmark at top, grouped nav in middle, theme toggle in footer. Active nav: saffron-soft background, saffron-deep text, saffron icon.

### Right Panel

Fixed 320px, paper background, left border. Contextual panels: Search (default), Inspector (graph/mindmap), Citations (chat/AI). Hidden below lg.

### Cards

Paper-raised background, warm border, 10px radius, soft shadow. Hover: lifted shadow, saffron border tint. Titles in Newsreader serif; metadata in small muted text.

### Buttons

- **Primary**: ink fill, paper text, for the single most important action
- **Secondary**: paper background, ink text, warm border
- **Ghost**: transparent, ink-mute text, for toolbars
- **Saffron**: saffron fill, white text, brand CTAs (sparingly)

All buttons: 6px radius, 12px font, 44px minimum touch target.

### Inputs

Paper background, warm border, 6px radius. Focus: saffron border with saffron ring. Placeholder in ink-faint.

### Chips and Badges

Rounded-full, muted background, 10px font. Status dots: colored circles. Kbd hints: muted background, mono font, 10px.

### Toasts

Sonner at bottom-right, rich colors, close button. Semantic types: success, error, info.

### Empty States

Centered column: faint icon, short headline (14px medium), one-line hint (12px muted). Primary CTA uses saffron or primary button.

## 7. Do and Do Not

### Do

- Do use saffron as the single primary accent color.
- Do use Newsreader serif for all headings.
- Do keep surfaces warm and paper-toned.
- Do use warm-tinted borders and shadows.
- Do keep cards flat and compact.
- Do maintain 44px minimum touch targets.
- Do use the focus-ring utility on every interactive element.
- Do respect prefers-reduced-motion.

### Do Not

- Do not use pure black (#000) or pure white (#fff).
- Do not use sans-serif for headings.
- Do not use multiple accent colors for decoration.
- Do not use grey borders — always warm.
- Do not use heavy shadows or glassmorphism.
- Do not use purple gradients, neon colors, or AI-tool glow.
- Do not nest cards inside cards.
- Do not use bounce or elastic easing.
- Do not put saffron text on paper background at small sizes (contrast fails).
- Do not let the visual system hide the product.
