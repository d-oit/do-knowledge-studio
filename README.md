# DO Knowledge Studio

A local-first knowledge studio for rich notes, knowledge graphs, mind maps,
semantic search, and AI-assisted thinking — all in your browser, no backend
required.

This repository contains the redesigned DO Knowledge Studio: a Next.js 16 app
that reimagines the original Vite + React SPA as a calmer, more deliberate
editorial workspace. The visual language is "Editorial Paper & Saffron" — warm
paper backgrounds, deep ink type, and a single saffron accent. See
[DESIGN-SYSTEM.md](./DESIGN-SYSTEM.md) for the full design reference.

## Tech stack

- **Next.js 16** (App Router) with React 19
- **TypeScript** strict mode
- **Tailwind CSS 4** with `@theme inline` token mapping
- **shadcn/ui** primitives (Radix UI + CVA)
- **Zustand** for app state
- **Framer Motion** for animation
- **Lucide** icon set
- **Sonner** for toast notifications
- **next-themes** for light/dark theming
- **cmdk** for the command palette
- **next/font/google** for Newsreader, Geist Sans, Geist Mono

## The nine views

| View         | One-line description                                                        |
|--------------|-----------------------------------------------------------------------------|
| Home         | Dashboard with stats, recent activity, and entity-type breakdown.           |
| Editor       | Capture a thought, claim, or note with floating toolbar, tags, and meta.    |
| Library      | Browse and filter entities in a grid or list with sort and type filters.    |
| Graph        | Visualize relationships as an interactive SVG graph with three layouts.     |
| Mind Map     | Hierarchical exploration with expandable tree, depth slider, and root selector. |
| Chat         | Ask your library; the assistant answers with grounded citations.            |
| AI Harness   | Configure LLM providers (Anthropic, OpenAI, Ollama) and chat with models.   |
| TRIZ Matrix  | Solve inventive contradictions via a 2-step parameter picker + principle results. |
| Export       | Backup and share your knowledge as Markdown, JSON, or encrypted archive.    |

## How to run

```bash
bun install
bun run dev
```

The app is served at `http://localhost:3000`. The dev log is tee'd to
`dev.log` in the project root.

Other scripts:

```bash
bun run lint      # eslint
bun run build     # production build
bun run start     # serve the standalone production build
bun run db:push   # prisma db push (if you use the prisma layer)
```

## Project structure

```
src/
  app/
    globals.css          # design tokens, base layer, utility classes
    layout.tsx           # root layout, fonts, toaster, theme provider
    page.tsx             # renders <AppShell />
  components/
    studio/
      app-shell.tsx      # 3-column shell: sidebar | main | right panel
      topbar.tsx         # responsive header with inline quick-search
      sidebar.tsx        # nav with grouped items + shortcuts
      right-panel.tsx    # contextual search / inspector / citations
      command-palette.tsx
      theme-provider.tsx
      views/             # the 9 view components
      ...
    ui/                  # shadcn primitives (do not hand-edit)
  lib/
    studio/
      store.ts           # zustand store + selectors
      types.ts           # Entity, Claim, ChatMessage, ENTITY_TYPE_META
      seed-data.ts       # mock entities / claims / chat
    utils.ts             # cn() class merge
    db.ts                # prisma client (unused by the studio shell)
public/
  logo.svg
DESIGN-SYSTEM.md         # full design reference
worklog.md               # build log
```

## Design system

The full design reference — color tokens, typography, spacing, radius,
shadows, focus rings, component patterns, layout, and accessibility rules —
lives in [DESIGN-SYSTEM.md](./DESIGN-SYSTEM.md). Read it before adding new
components or touching tokens in `globals.css`.

## Local-first principles

- All entity data lives in the Zustand store (seeded from
  `src/lib/studio/seed-data.ts`). There is no network call required to use the
  app.
- The "Offline ready" badge in the topbar is a constant reminder of this
  promise.
- Export is the user's escape hatch — Markdown, JSON, or an encrypted archive.
- The AI Harness view supports local Ollama models so the entire workflow can
  stay on-device.

## License

Internal project. See the original repository for licensing context.
