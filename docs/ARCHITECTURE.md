# Architecture

`do-knowledge-studio` is a local-first application that uses browser-native technologies for storage, search, and visualization.

## Data Flow

### 1. Persistence Pipeline (UI -> SQLite)
All state changes originate in the UI (React components) and are persisted to SQLite.

- **UI Components**: Trigger actions (e.g., `createEntity`).
- **Repository (`src/db/repository.ts`)**: Provides a high-level API for CRUD operations.
- **Connection Pool (`src/db/connection-pool.ts`)**: Manages a queue of requests to the database worker.
- **SQLite Worker (`src/db/db-worker.ts`)**: Runs in a separate thread to avoid blocking the main UI thread. It interacts with the SQLite WASM build.
- **OPFS (Origin Private File System)**: Provides the underlying persistent storage in the browser.

### 2. Search Indexing Pipeline (SQLite -> Orama)
The search index is kept in sync with the database via a job queue.

- **Job Coordinator (`src/lib/jobs.ts`)**: Orchestrates background tasks like re-indexing.
- **Search System (`src/lib/search.ts`)**:
  - Performs FTS5 queries against SQLite for exact matches.
  - Hydrates and queries the Orama index for semantic and fuzzy search.
  - Combines results into a unified `RankedResult` list.

### 3. CLI and Export Pipeline
The CLI provides a bridge between the local filesystem and the browser-native database.

- **CLI (`cli/index.ts`)**: Uses the same `repository` logic but runs in a Node.js environment.
- **Markdown Sync**: Reads `.md` files and populates the database.
- **Export Engine**: Reads the entire database and generates:
  - Markdown files (structured according to entity types).
  - JSON (for data portability).
  - Static Site (portable HTML/CSS/JS representation of the knowledge base).

## Module Boundaries

- **`src/app`**: Application entry point and layout.
- **`src/db`**: Low-level storage and repository. No UI dependencies.
- **`src/features`**: Self-contained feature islands (Editor, Graph, Chat). They depend on `src/db` for data.
- **`src/lib`**: Logic-only utilities. Used by both `src/features` and `cli`.
- **`cli`**: Entry point for terminal-based automation.
- **`export`**: Template and logic for static site generation.
