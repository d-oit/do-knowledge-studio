# Rust Development Patterns

> Reference doc - not loaded by default.
> Remove this file if your project is not Rust.

## Toolchain

- Stable toolchain, edition 2021
- `cargo fmt` + `cargo clippy -- -D warnings` must pass before every commit
- All fallible public APIs return `Result<T, Error>`
- Errors defined via `thiserror`; propagation via `anyhow` or `?`

## Async and Concurrency

- Async I/O via Tokio; CPU parallelism via Rayon
- Do NOT share a single Connection across async tasks via `RwLock`
  Use per-operation `connect()` instead - cheap and avoids Send/Sync issues
- Gate WASM threading: `#[cfg(not(target_arch = "wasm32"))]`

## Numeric Safety

- `f32::total_cmp()` for float sorting - **never** `partial_cmp().unwrap()` (panics on NaN)
- Seeded RNG (`StdRng::seed_from_u64(42)`) in tests for determinism

## Memory and Performance

- Dense matrices for large N are infeasible - use CSR sparse format
- `Vec<Vec<(usize, f32)>>` has allocator overhead; prefer contiguous CSR buffers
- Memory locality often dominates arithmetic throughput for large sparse structures
- No connection pooling for local SQLite - no benefit, adds overhead

## Code Organization

- Max 500 lines per source file - split into focused sub-modules if exceeded
- No hardcoded magic numbers - named constants or config only
- Never create unused code - verify at least one usage site before adding APIs
- Architecture diagrams in ```mermaid``` blocks, never raw ASCII art

## CI Validation

```bash
cargo fmt --check
cargo clippy -- -D warnings
cargo test
cargo build --release
```

## WASM

```bash
cargo build --target wasm32-unknown-unknown
wasm-pack build --target web
```

Gate all threading/I/O with `#[cfg(not(target_arch = "wasm32"))]`.