# Architecture: do-knowledge-studio

## Storage (The Truth)
- **SQLite WASM**: Relational engine for high-integrity metadata.
- **OPFS**: Browser-native high-performance file system for persistence.

## Model (The Structure)
- **Entities**: Unique IDs, names, types (Canonical subjects).
- **Claims**: Assertions about entities with confidence and sources.
- **Links**: Directional, typed relationships between entities.
- **Notes**: Unstructured or semi-structured context.

## Interface (The Perspectives)
- **Editor**: Entry point for entities and claims.
- **Graph**: Discovery of non-obvious links.
- **Mind Map**: Hierarchical organization.
- **Chat**: Synthesis and retrieval via local search.
