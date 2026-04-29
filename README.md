# do-knowledge-studio

A local-first knowledge management studio for structured data and synthesis. Built with React, SQLite WASM, and Orama search.

## Features

- ✍️ **Structured Editor**: Tiptap-based editor with claims and entity mentions. (`src/features/editor/`)
- 🕸️ **Knowledge Graph**: Interactive visualization of entities and links using Sigma.js. (`src/features/graph/`)
- 🗺️ **Mind Maps**: Hierarchical organization via Mind Elixir. (`src/features/mindmap/`)
- 🔍 **Local RAG**: Semantic search and chat powered by Orama. (`src/features/chat/`, `src/features/search/`)
- 💾 **Local-first Storage**: SQLite WASM + OPFS for high-performance persistence. (`src/db/`)
- 📦 **Static Export**: Export your knowledge base to a portable static site. (`src/features/export/`, `cli/`)
- 🤖 **Agent Harness**: Integrated support for AI coding agents with a structured skill system. (`.agents/`)

## Quick Start

### Prerequisites
- Node.js 20+
- npm 10+

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```
The application will be available at `http://localhost:5173`.

### CLI Usage
```bash
# Sync markdown files to the database
npm run cli -- sync ./my-notes

# Export to static site
npm run cli -- export --format site --output ./dist-site
```

## Architecture

The application follows a decoupled architecture where the UI layer communicates with a central SQLite repository via a worker-managed connection pool.

```text
UI (React) <-> Connection Pool <-> SQLite Worker <-> OPFS
      |               |
      v               v
Chat/Search <---> Orama Index
```

- **`src/db/`**: Core storage logic, SQLite WASM initialization, and repository pattern.
- **`src/features/`**: Feature-specific UI and logic islands.
- **`src/lib/`**: Shared utilities for search, jobs, and validation.
- **`cli/`**: Automation layer for sync and export.
- **`.agents/`**: AI agent skills and configuration.

## Documentation

- [Architecture Guide](docs/ARCHITECTURE.md)
- [Setup & Deployment](docs/SETUP.md)
- [Agent Workflow](AGENTS.md)
- [Contributing](CONTRIBUTING.md)

## License

MIT
