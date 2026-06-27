# do-knowledge-studio

> A local-first knowledge management studio — rich notes, knowledge graph, mind maps, full-text search, and AI agent integration in a single browser-based app.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-0.2.5-blue)](VERSION)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Built with React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite)](https://vitejs.dev)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen)](#testing)
[![Coverage](https://img.shields.io/badge/coverage-40%25%2B-blue)](#testing)

**Quick Links**: [Quick Start](#-quick-start) · [Features](#-features) · [Architecture](#-architecture) · [AI Agents](#-ai-agent-integration) · [Contributing](#-contributing)

---

## What Is This?

**do-knowledge-studio** is a local-first, offline-capable knowledge management application built with React 19, TypeScript 5, and SQLite WASM. It combines a rich-text editor, an interactive knowledge graph, mind mapping, blazing-fast full-text search, and a static site export — all running entirely in the browser with no backend required.

It also ships with an **AI agent harness** supporting Claude Code, Gemini CLI, OpenCode, Qwen Code, Windsurf, and Cursor — making it a great base for AI-assisted personal knowledge management workflows.

## 🚧 Status

This project is in active development. See [PHASES.md](docs/PHASES.md) for progress tracking.

---

## ✨ Features

- **📝 Rich Text Editor** — TipTap-powered WYSIWYG editor with Markdown support and placeholder hints
- **🗄️ Local SQLite Database** — Persistent, offline-first storage via `@sqlite.org/sqlite-wasm` with FTS5 full-text search
- **🔍 Semantic & Full-Text Search** — Orama-powered in-browser search index for fast, context-aware retrieval
- **🕸️ Knowledge Graph** — Interactive node-link graph built with Graphology + Sigma.js; focus mode for deep neighborhood exploration
- **🧠 Mind Maps** — Visual mind mapping with Mind Elixir for brainstorming and concept structuring
- **📤 Static Site Export** — Turn your knowledge base into a shareable, self-contained static site (Markdown, JSON, HTML)
- **🤖 AI Agent Harness** — Unified workflow across 6+ AI coding tools with skills, quality gates, and sub-agent patterns
- **🔬 Swarm Analysis** — Parallel AI-powered web research using git worktrees
- **🔒 AES-256-GCM Encryption** — API keys encrypted at rest via Web Crypto API
- **⚡ CLI** — TypeScript CLI with 20 commands for scripting and automation
- **🧪 Full Test Suite** — 671 Vitest unit tests + Playwright end-to-end tests

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+ ([install](https://nodejs.org))
- A modern browser (Chrome, Firefox, Edge)
- *(Optional)* An AI coding CLI: [Claude Code](https://claude.ai/code), [Gemini CLI](https://gemini.google.com), [OpenCode](https://opencode.ai), [Qwen Code](https://github.com/QwenLM/Qwen-Coder)

### Installation

```bash
git clone https://github.com/d-oit/do-knowledge-studio.git
cd do-knowledge-studio
pnpm install
```

### Development

```bash
pnpm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build

```bash
pnpm run build
pnpm run preview
```

### Environment

```bash
cp .env.example .env
# Edit .env as needed
```

---

## 🏗️ Architecture

<!-- START_DIAGRAM -->

```mermaid
graph TD
    subgraph UI_Layer [UI Layer (React 19)]
        Editor[Rich Text Editor]
        Graph[Knowledge Graph]
        MindMap[Mind Maps]
        Chat[AI Chat]
    end

    subgraph Logic_Layer [Logic & Search]
        Repository[Repository API]
        Orama[Orama Search Index]
        Jobs[Job Coordinator]
    end

    subgraph Data_Layer [Data & Storage]
        Worker[SQLite Worker]
        SQLite[SQLite WASM + FTS5]
        OPFS[Browser OPFS Storage]
    end

    Editor --> Repository
    Graph --> Repository
    MindMap --> Repository
    Chat --> Repository
    Chat --> Orama

    Repository --> Jobs
    Jobs --> Orama
    Repository --> Worker
    Worker --> SQLite
    SQLite --> OPFS

    CLI[TS CLI] --> Repository
    Export[Export Engine] --> Repository
```

<!-- END_DIAGRAM -->

```
src/
├── app/          # React app shell, routing, layout
├── db/           # SQLite WASM database layer + FTS5 search
├── features/     # Feature modules (editor, graph, mindmap, search, export)
├── lib/          # Shared utilities and Orama search index
└── main.tsx      # Entry point

cli/              # TypeScript CLI for automation
export/           # Static site export engine
scripts/          # Setup and quality gate scripts
tests/            # Playwright e2e tests
```

### Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | React 19 + TypeScript 5 |
| Build Tool | Vite 8 |
| Database | SQLite WASM (FTS5) |
| Search | Orama 3 |
| Rich Text | TipTap 3 |
| Graph | Graphology + Sigma.js |
| Mind Map | Mind Elixir 5 |
| Validation | Zod |
| Icons | Lucide React |
| Unit Tests | Vitest 4 |
| E2E Tests | Playwright |

---

## 🤖 AI Agent Integration

This project ships with a unified AI agent harness that works across multiple tools:

```
AGENTS.md           # Single source of truth for all agents
├── CLAUDE.md       # Claude Code overrides
├── GEMINI.md       # Gemini CLI overrides
├── QWEN.md         # Qwen Code overrides
└── .opencode/       # OpenCode configuration
```

### Skills System

Reusable knowledge modules live in `.agents/skills/` and are symlinked into each tool's config directory:

```
.agents/skills/         # Canonical skill source
.claude/skills/         # Symlinks → ../../.agents/skills/
.gemini/skills/         # Symlinks → ../../.agents/skills/
.qwen/skills/           # Symlinks → ../../.agents/skills/
```

### Setup Agent Skills

```bash
# Create skill symlinks (run once)
./scripts/setup-skills.sh

# Validate setup
./scripts/validate-skills.sh
```

### Sub-Agent Patterns

```mermaid
graph LR
    A[Main Agent] --> B[Sub-Agent 1]
    A --> C[Sub-Agent 2]
    B --> D[Task Complete]
    C --> E[Task Complete]
    D --> F[Synthesize]
    E --> F
```

---

## 🧪 Testing

```bash
# Unit tests
pnpm run test

# Watch mode
pnpm run test:watch

# End-to-end tests
pnpm run test:e2e

# Type checking
pnpm run typecheck

# Lint
pnpm run lint
```

---

## ⚙️ CLI

The CLI enables automation and scripting for your knowledge base. It shares a common database file with the browser app, allowing for seamless integration between automated tools and visual exploration.

**Default Database Path**: `~/.local/share/do-knowledge-studio/data.db`

```bash
# List all entities
pnpm run cli -- entity-list

# Import from a directory
pnpm run cli -- sync ./notes

# Use a custom database path
pnpm run cli -- --db-path ./custom.db entity-list
```

See [SETUP.md](docs/SETUP.md) for detailed CLI instructions and how to connect the browser to the shared database.

---

## 📚 Documentation

- 📖 **[AGENTS.md](AGENTS.md)** — AI agent instructions (single source of truth)
- 🏗️ **[Harness Overview](agents-docs/HARNESS.md)** — Architecture and patterns
- 🪝 **[Skills Guide](agents-docs/AVAILABLE_SKILLS.md)** — Creating reusable skills
- 🤖 **[Sub-Agents](agents-docs/SUB-AGENTS.md)** — Context isolation patterns
- 🔧 **[Hooks](agents-docs/HOOKS.md)** — Pre/post tool hooks
- 📊 **[Context](agents-docs/CONTEXT.md)** — Back-pressure mechanisms
- ⚙️ **[Configuration](agents-docs/CONFIG.md)** — Repository constants and utilities
- 🔄 **[Migration](agents-docs/MIGRATION.md)** — Adopting in existing projects
- 🔒 **[Security](SECURITY.md)** — Security policy and reporting
- 📝 **[Changelog](CHANGELOG.md)** — Release history
- 🔧 **[CLI Reference](docs/CLI.md)** — All 20 CLI commands
- 🗄️ **[Database Schema](docs/DATABASE.md)** — Tables, ER diagram, migrations
- 🔍 **[Search Architecture](docs/SEARCH.md)** — Dual FTS5 + Orama search
- 🤖 **[LLM Setup](docs/LLM-SETUP.md)** — Provider configuration
- 📦 **[Repository API](docs/REPOSITORY-API.md)** — Full API reference
- 👩‍💻 **[Developer Guide](docs/DEVELOPMENT.md)** — Onboarding and common tasks

---

## 🤝 Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for:

- Development environment setup
- Code style and testing requirements
- Pull request process
- Good first issues

## Community

- 🐛 [Issue Tracker](https://github.com/d-oit/do-knowledge-studio/issues) — Report bugs
- 💬 [Discussions](https://github.com/d-oit/do-knowledge-studio/discussions) — Ask questions

---

## License

Licensed under the [MIT License](LICENSE).

---

**Local-first. AI-assisted. Built to think.**
