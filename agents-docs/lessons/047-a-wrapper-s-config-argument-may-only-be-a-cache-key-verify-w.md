### LESSON-047: A wrapper's "config" argument may only be a cache key — verify what the command receives

`scripts/quality_gate.sh` called `lint_if_changed "$file" markdownlint
markdownlint.toml markdownlint "$file"`. The third argument is hashed into the
cache key by `scripts/lib/lint_cache.sh` and **never appended to the command**, so
the gate invoked `markdownlint <file>` with stock rules. On any machine where
markdownlint is installed, the gate failed *correct* documents (MD013/MD025) —
and because CI has no markdownlint on `PATH`, the same section was skipped there,
so neither side ever disagreed out loud.

The general rule: when a wrapper takes `(file, tool, config, cmd…)`, read the
wrapper to see whether `config` reaches `cmd`. Reproduce the gate's own invocation
rather than a hand-written one — a `markdownlint --config … <file>` you type
yourself proves nothing about what the gate runs. A shim on `PATH` (a script that
`exec`s the real binary) turns this into a one-line before/after test.

**Tags**: #shell #quality-gate #verification

---
