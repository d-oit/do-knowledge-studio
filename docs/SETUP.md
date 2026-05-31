# Setup & Deployment

This guide covers setting up the development environment and using the CLI for data operations.

## Prerequisites

- **Node.js**: v20 or higher
- **pnpm**: v10 or higher
- **Browser**: Chrome, Edge, or any browser supporting OPFS (Origin Private File System).

## Installation

1. Clone the repository.
2. Install dependencies:
   ```bash
   pnpm install
   ```

## Development

Start the Vite development server:
```bash
pnpm run dev
```
Open `http://localhost:5173` in your browser.

## CLI Usage

The CLI interacts with the database in a Node.js environment. By default, it uses a shared database file at `~/.local/share/do-knowledge-studio/data.db` (Linux/macOS) or the corresponding user data path on Windows.

### Shared Database with Browser

To see CLI-created data in the browser app:
1. Open the app in a modern browser (Chrome, Edge).
2. Go to **AI Harness** and click the **Settings** (gear) icon.
3. Click **Connect Local Database**.
4. Select the database directory (usually `~/.local/share/do-knowledge-studio/`).
5. Reload the page when prompted.

The browser will now synchronize its internal storage (OPFS) with the `data.db` file in that directory.

### CLI Options

You can specify a custom database path using the `--db-path` global flag:
```bash
pnpm run cli -- --db-path ./my-data.db entity-list
```

### Initialize Workspace
```bash
pnpm run cli -- init
```

### Sync Markdown Files
Populate your database from a directory of markdown files. The first line of each file (H1) is treated as the entity name.
```bash
pnpm run cli -- sync ./path/to/markdown/files
```

### Export Data
Export your knowledge base to various formats.

**Markdown:**
```bash
pnpm run cli -- export --format md --output ./export/markdown
```

**JSON:**
```bash
pnpm run cli -- export --format json --output ./export/json
```

**Static Site:**
```bash
pnpm run cli -- export --format site --output ./export/site
```

### Manage Entities and Claims
```bash
# Create an entity
pnpm run cli -- entity-create "Artificial Intelligence" --type concept --description "The simulation of human intelligence by machines."

# List entities
pnpm run cli -- entity-list

# Create a claim for an entity
pnpm run cli -- claim-create "Artificial Intelligence" "AI can solve complex problems" --confidence 0.95
```

## Environment Variables

Copy `.env.example` to `.env` (if applicable) to configure environment-specific settings.
*Note: Currently, the core app is local-first and does not require external API keys for basic functionality.*
