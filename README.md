# DO Knowledge Studio

A local-first knowledge studio for rich notes, knowledge graphs, mind maps, client-side semantic search, TRIZ inventive problem-solving, and AI-assisted synthesis — all inside your browser with **zero server backend required**.

The visual language follows **Editorial Paper & Saffron**: warm paper backgrounds, crisp ink typography, and a purposeful saffron accent. See [DESIGN.md](./DESIGN.md) for the complete design token reference.

---

## Key Capabilities

- **Local-First & Private**: Core notes, entities, and claims persist through Zustand and browser `localStorage`; pre-import recovery snapshots also use localStorage. Yjs also persists a separate collaboration replica in IndexedDB. No remote backend or database setup needed.
- **Peer-to-Peer Multi-Device Sync**: Decentralized WebRTC peer-to-peer synchronization powered by Yjs CRDTs, featuring QR-code device pairing, live presence indicators, and remote collaborative cursors.
- **Client-Side Search Engine**: Browser-local BM25 keyword search and embedding-based semantic retrieval. Lexical search uses a Web Worker when available, with an in-browser fallback.
- **Knowledge Graph & Mind Map**: Interactive SVG graph visualization with Force, Circular, and Hierarchical layouts, alongside expandable mind map tree navigation with depth filtering.
- **TRIZ Contradiction Matrix**: Full interactive Altshuller 39×39 contradiction matrix with 40 inventive principles to systematically resolve engineering trade-offs without compromise.
- **Universal Export & OKF Bundles**: Export agent-readable Open Knowledge Format (OKF v0.2) ZIP bundles, password-encrypted standalone HTML readers, Markdown, JSON, HTML, DOCX, or PDF.
- **AI Assistant Harness**: Connect to [OpenRouter](https://openrouter.ai/), local [Ollama](https://ollama.ai/) instances, or optional in-browser models for grounded citations and client-side tool-calling. Browser models download weights on first use; later inference can run offline while the browser retains those cached assets.
- **Accessible & Responsive**: Semantic, keyboard-accessible controls, the `?` shortcuts palette, mobile drawer layout, and support for `prefers-reduced-motion`.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Framework & UI** | [Next.js 16](https://nextjs.org/) (App Router), [React 19](https://react.dev/), [Tailwind CSS 4](https://tailwindcss.com/) (`@theme inline`), [shadcn/ui](https://ui.shadcn.com/) (Radix UI + CVA) |
| **State & Storage** | [Zustand](https://github.com/pmndrs/zustand) with localStorage persistence and local recovery snapshots; IndexedDB persistence for the Yjs sync replica; Zod schema boundaries |
| **Sync & CRDT** | [Yjs](https://yjs.dev/), WebRTC peer channels, tombstone tracking, three-way merge resolution |
| **Search & Retrieval** | BM25 keyword search in a Web Worker and in-browser embedding-based semantic retrieval |
| **Animations & Icons** | [Framer Motion](https://www.framer.com/motion/), [Lucide React](https://lucide.dev/), [Sonner](https://sonner.emilkowal.ski/) toasts |
| **Typography & Theme** | Newsreader (serif headings), Geist Sans (body), Geist Mono (code), `next-themes` (Light/Dark) |
| **Testing & Quality** | [Vitest](https://vitest.dev/) (unit/integration), [Playwright](https://playwright.dev/) E2E, [ESLint 10](https://eslint.org/) |

---

## The Eleven Studio Views

| View | Description |
|---|---|
| **Home** | Overview dashboard with entity metrics, recent activity timeline, and entity-type distribution badges. |
| **Editor** | Rich markdown note and claim editor with floating formatting toolbar, tag selector, metadata editor, and link autocomplete. |
| **Library** | Grid and list browser with real-time full-text search, type filtering, tag chips, and multiple sorting dimensions. |
| **Graph** | Interactive knowledge graph supporting Force-directed, Circular, and Hierarchical layout algorithms with focus neighborhood mode. |
| **Mind Map** | Hierarchical knowledge exploration with expandable root branches, depth slider controls, and subtree zooming. |
| **Timeline** | Chronological view of entities and claims, grouped by month and day; selecting an item opens its entity in the editor. |
| **Chat** | Local search chat assistant that answers queries with verifiable, clickable citations linked directly to your entities. |
| **AI Harness** | Multi-provider playground with OpenRouter routers, Ollama, in-browser models, and client-side tool calls. |
| **TRIZ Matrix** | 2-step inventive contradiction solver mapping 39 improving vs. 39 worsening engineering parameters to 40 Altshuller principles. |
| **Export** | Backup and sharing suite: OKF v0.2 ZIP bundles, password-encrypted HTML readers, Markdown, JSON, HTML, DOCX, and PDF. |
| **Sync** | Peer-to-peer WebRTC rooms with QR pairing, presence, and conflict resolution. |

---

## Getting Started

### Prerequisites

- **Node.js**: $\ge 22$ (pinned by `.nvmrc` and permitted by `package.json` `engines`)
- **pnpm**: `10.30.3` (pinned by `package.json` `packageManager`)

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
pnpm run build        # Build the production bundle and regenerate the offline precache manifest
pnpm run start        # Start Next.js production server
pnpm run lint         # Run ESLint across all source files (zero-warning policy)
pnpm run typecheck    # Run TypeScript compiler type-checking without emitting
pnpm run test         # Run Vitest test suite with type-checking and assertions
pnpm run test:coverage # Run tests with v8 code coverage reporting
pnpm run test:e2e     # Run Playwright end-to-end browser tests
pnpm run test:e2e:offline # Run after `pnpm run build`; first-use offline view tests (Chromium)
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
│   │   │   ├── views/       # The 11 view implementations and view-specific handlers
│   │   │   └── ui/          # Shared studio UI primitives
│   │   └── ui/              # shadcn/ui accessible components (Radix primitives)
│   ├── hooks/               # Reusable React hooks (reduced motion, speech, keyboard)
│   ├── lib/
│   │   ├── ai/              # OpenRouter, Ollama, and in-browser model adapters, tools, and context
│   │   ├── export/          # Password-encrypted HTML export helpers
│   │   ├── okf/             # Open Knowledge Format bundle serialization and import
│   │   ├── search/          # Client BM25 retrieval engine & Web Worker client
│   │   ├── studio/          # Zustand store, schema, hydration, migrations, local recovery helpers
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

1. **Zero Required Backend**: Core state and recovery snapshots use browser-local Zustand/`localStorage`; Yjs also persists a separate sync replica in browser IndexedDB.
2. **Strict Quality Gates**: Zero warnings tolerated in quality gates (`pnpm run lint`, `typecheck`, `test`, `build`).
3. **Max 500 LOC per File**: Source files remain modular, composable, and single-responsibility.
4. **Privacy & Security**: Cryptographic operations use WebCrypto (`crypto.subtle`, `crypto.randomUUID()`). No app backend receives library data; peer sync sends data to joined peers. AI requests send prompts to the configured provider; matching local snippets are included only when local-context augmentation is enabled.

---

## License

Internal project. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE) for details.
