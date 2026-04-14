---
name: memory-context
description: Retrieve semantically relevant past learnings and analysis outputs using the csm CLI (HDC encoder with hybrid BM25 retrieval)
version: "1.0"
---

# Memory Context

Retrieve semantically relevant past learnings, analysis outputs, and project knowledge using the `csm` (Chaotic Semantic Memory) CLI.

## Prerequisites

```bash
cargo install chaotic_semantic_memory --features cli
```

## When to Use

- At session start to recall previous work
- When facing a problem that might have been solved before
- To retrieve specific findings from `analysis/` or `agents-docs/`

## Indexing (Run Once)

```bash
# Index lessons (lessons.jsonl stores lesson summary text in "title")
csm index-jsonl -F agents-docs/lessons.jsonl --field title --id-field id --tag-field tags

# Index analysis outputs and docs
csm index-dir --glob "analysis/**/*.md" --glob "agents-docs/*.md" --heading-level 2
```

Index stored in `.git/memory-index/csm.db` (per-clone, never committed).

## Querying

```bash
# Natural language query (default: hybrid retrieval)
csm query "how to handle git worktree cleanup" --top-k 5

# Code identifier query (exact match optimized)
csm query "MAX_CONTEXT_TOKENS" --top-k 3 --output-format json

# Code-heavy query
csm query "get_user_by_id" --code-aware --top-k 5
```

## Output Formats

- `--output-format table` (default): human-readable
- `--output-format json`: machine-parseable for agent consumption
- `--output-format quiet`: IDs only

## Token Budget

Use a hard post-query cap from `.agents/config.sh`:

```bash
source .agents/config.sh
csm query "how to handle git worktree cleanup" --top-k 8 --output-format table |
awk -v max_tokens="$MAX_CONTEXT_TOKENS" '
{
    for (i = 1; i <= NF; i++) {
        if (token_count < max_tokens) {
            printf "%s%s", $i, (token_count + 1 < max_tokens ? " " : "\n")
            token_count++
        } else {
            exit
        }
    }
}
'
```

This enforces an approximate token ceiling even if retrieval output is verbose.
