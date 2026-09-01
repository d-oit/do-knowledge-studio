# DO Knowledge Studio

A local-first knowledge studio for rich notes, knowledge graphs, mind maps, client-side semantic search, TRIZ inventive problem-solving, and AI-assisted synthesis — all inside your browser with **zero server backend required**.

The visual language follows **Editorial Paper & Saffron**: warm paper backgrounds, crisp ink typography, and a purposeful saffron accent. See [DESIGN.md](./DESIGN.md) for the complete design token reference.

---

## Key Capabilities

- **Local-First & Private**: All notes, entities, and claims persist directly in your browser (`localStorage` + `IndexedDB` tiered backup). No remote backend or database setup needed.
- **Peer-to-Peer Multi-Device Sync**: Decentralized WebRTC peer-to-peer synchronization powered by Yjs CRDTs, featuring QR-code device pairing, live presence indicators, and remote collaborative cursors.
- **Client-Side Search Engine**: High-performance in-browser BM25 and TF-IDF search engine offloaded to dedicated Web Workers for zero main-thread lag during live typing.
- **Knowledge Graph & Mind Map**: Interactive SVG graph visualization with Force, Circular, and Hierarchical layouts, alongside expandable mind map tree navigation with depth filtering.
- **TRIZ Contradiction Matrix**: Full interactive Altshuller 39×39 contradiction matrix with 40 inventive principles to systematically resolve engineering trade-offs without compromise.
- **Universal Export & OKF Bundles**: Export and share your knowledge as Open Knowledge Format (OKF v0.2) agent-readable bundles, AES-GCM password-encrypted `.okf` archives, Markdown, JSON, HTML, Docx, or PDF.
- **AI Assistant Harness**: Connect to [OpenRouter](https://openrouter.ai/) (with support for both concrete models and smart automated routers) or local [Ollama](https://ollama.ai/) instances for on-device inference, grounded citations, and client-side tool-calling.
- **Accessible & Responsive**: WCAG 2.2 AA compliant, comprehensive keyboard navigation (`?` for shortcuts palette), mobile drawer layout, and respect for `prefers-reduced-motion`.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Framework & UI** | [Next.js 16](https://nextjs.org/) (App Router), [React 19](https://react.dev/), [Tailwind CSS 4](https://tailwindcss.com/) (`@theme inline`), [shadcn/ui](https://ui.shadcn.com/) (Radix UI + CVA) |
| **State & Storage** | [Zustand](https://github.com/pmndrs/zustand) with localStorage persistence, IndexedDB tiered recovery snapshots, Zod schema boundaries |
| **Sync & CRDT** | [Yjs](https://yjs.dev/), WebRTC peer channels, tombstone tracking, three-way merge resolution |
| **Search & Retrieval** | In-browser BM25 term-frequency engine, Web Worker async client, fast prefix tokenization |
| **Animations & Icons** | [Framer Motion](https://www.framer.com/motion/), [Lucide React](https://lucide.dev/), [Sonner](https://sonner.emilkowal.ski/) toasts |
| **Typography & Theme** | Newsreader (serif headings), Geist Sans (body), Geist Mono (code), `next-themes` (Light/Dark) |
| **Testing & Quality** | [Vitest](https://vitest.dev/) (2,300+ tests), [Playwright](https://playwright.dev/) E2E, [ESLint 9](https://eslint.org/), [Biome](https://biomejs.dev/) |

---

## The Nine Studio Views

| View | Description |
|---|---|
| **Home** | Overview dashboard with entity metrics, recent activity timeline, and entity-type distribution badges. |
| **Editor** | Rich markdown note and claim editor with floating formatting toolbar, tag selector, metadata editor, and link autocomplete. |
| **Library** | Grid and list browser with real-time full-text search, type filtering, tag chips, and multiple sorting dimensions. |
| **Graph** | Interactive knowledge graph supporting Force-directed, Circular, and Hierarchical layout algorithms with focus neighborhood mode. |
| **Mind Map** | Hierarchical knowledge exploration with expandable root branches, depth slider controls, and subtree zooming. |
| **Chat** | Local search chat assistant that answers queries with verifiable, clickable citations linked directly to your entities. |
| **AI Harness** | Multi-provider playground supporting OpenRouter smart routers, concrete models, Ollama local inference, and live tool calls. |
| **TRIZ Matrix** | 2-step inventive contradiction solver mapping 39 improving vs. 39 worsening engineering parameters to 40 Altshuller principles. |
| **Export** | Comprehensive backup and sharing suite supporting OKF v0.2 ZIP bundles, encrypted archives, Markdown, JSON, HTML, Docx, and PDF. |

---

## Getting Started

### Prerequisites

- **Node.js**: $\ge 20$ (enforced via `.nvmrc` and `package.json` `engines`)
- **pnpm**: $\ge 10$ (this repository uses `pnpm` exclusively)

### Installation & Development

```bash
# Clone the repository
git clone https://github.com/d-oit/do-knowledge-studio.git
cd do-knowledge-studio

# Install dependencies and git hooks
pnpm install

# Start the local development server
pnpm run dev
```

The application is served at `http://localhost:3000`.

### Available Scripts

```bash
pnpm run dev          # Start Next.js development server with hot reloading
pnpm run build        # Build optimized production bundle
pnpm run start        # Start Next.js production server
pnpm run lint         # Run ESLint across all source files (zero-warning policy)
pnpm run typecheck    # Run TypeScript compiler type-checking without emitting
pnpm run test         # Run Vitest test suite with type-checking and assertions
pnpm run test:coverage# Run tests with v8 code coverage reporting
pnpm run test:e2e     # Run Playwright end-to-end browser tests
./scripts/minimal_quality_gate.sh # Fast-path local validation suite
./scripts/quality_gate.sh         # Complete pre-commit quality gate
```

---

## Repository Structure

```
.
├── src/
│   ├── app/                 # Next.js App Router (layout, page shell, globals.css tokens)
│   ├── components/
│   │   ├── studio/          # Studio shell, topbar, sidebar, right panel, dialogs
│   │   │   ├── views/       # The 9 view implementations (Home, Editor, Graph, Chat, etc.)
│   │   │   └── ui/          # Shared studio UI primitives
│   │   └── ui/              # shadcn/ui accessible components (Radix primitives)
│   ├── hooks/               # Reusable React hooks (reduced motion, speech, keyboard)
│   ├── lib/
│   │   ├── ai/              # AI provider adapters (OpenRouter, Ollama), tools, and context
│   │   ├── export/          # Export handlers (OKF bundle, JSON, Markdown, HTML, AES encrypt)
│   │   ├── search/          # Client BM25 retrieval engine & Web Worker client
│   │   ├── studio/          # Zustand store, schema, hydration, migrations, IndexedDB backup
│   │   └── sync/            # WebRTC sync bridge, Yjs CRDT documents, presence, conflict logic
│   └── test/                # Test utilities, fixtures, and builder helpers
├── plans/                   # GOAP plans, task decomposition, and architecture decision records (ADRs)
├── analysis/                # Systematic architectural audits (e.g. TRIZ Contradiction Audits)
├── scripts/                 # Reusable validation, quality gates, and automated repair scripts
├── agents-docs/             # Multi-agent coordination guides, rules, and hook documentation
└── public/                  # Static assets and PWA service worker manifest
```

---

## AI Harness & OpenRouter Routers

The AI Harness integrates with [OpenRouter](https://openrouter.ai/) for seamless access to top-tier LLMs, as well as first-class support for OpenRouter's smart **Routers**:

| Router | Purpose & Best Use Case |
|---|---|
| **Auto Router** (`openrouter/auto`) | Automatically chooses the optimal model based on prompt complexity and length. |
| **Free Models Router** (`openrouter/free`) | Routes exclusively to available free models for zero-cost experimentation. |
| **Fusion Router** (`openrouter/fusion`) | Multi-model deliberation panel that synthesizes responses for complex research. |
| **Pareto Router** (`openrouter/pareto`) | Balances speed, cost, and benchmark performance for fast agentic execution. |
| **Latest Model Resolution** (`openrouter/flavor-latest`) | Dynamically resolves to the newest available model in a specific model family. |

---

## Local-First Philosophy & Design Rules

1. **Zero Required Backend**: Persistence is 100% browser-based via Zustand, `localStorage`, and `IndexedDB`.
2. **Strict Quality Gates**: Zero warnings tolerated in quality gates (`pnpm run lint`, `typecheck`, `test`, `build`).
3. **Max 500 LOC per File**: Source files remain modular, composable, and single-responsibility.
4. **Privacy & Security**: Cryptographic operations use standard WebCrypto APIs (`crypto.subtle`, `crypto.randomUUID()`). No user data is sent over the network unless the user explicitly configures an AI provider.

---

## License

Internal project. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE) for details.
