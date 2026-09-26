# ADR 040: CPU-First Local AI Inference

**Date**: 2026-09-26
**Status**: Implemented
**Supersedes (in part)**: ADR 025
**Related**: Plan 155

## Context

ADR 025 consolidated the AI Harness onto OpenRouter plus Ollama and made
Ollama's CPU-only mode an **opt-in toggle** (`options.num_gpu: 0` when
enabled). In practice the toggle defaulted to off, so a user who installed
Ollama on a laptop without a working GPU stack got GPU-layer probing failures,
unusable latency on larger models, and battery drain — the failure mode that
prompted the toggle in the first place.

Separately, `ChatRequest.localDevice` was consumed by the in-browser adapter
but had no persistence path, so the WASM/WebGPU choice was unreachable from
the UI: a user could not select CPU even if they wanted to.

## Decision

**CPU is the invariant default; GPU is opt-in.**

- Ollama: `ollamaCpuOnly` defaults to `true` in the Zod schema, in
  `DEFAULT_SETTINGS`, and in the harness view state.
- In-browser (`local`): WASM is the default device, and WebGPU is a
  deliberate user choice exposed as a select in the settings panel.

A user who wants GPU acceleration turns it on and takes responsibility for
whether their device supports it. The default path must work on hardware with
no GPU at all.

Existing installations are unaffected: a persisted `ollamaCpuOnly: false` is
read back verbatim, so the flip only reaches new installations.

## Consequences

### Positive

- A default installation works on CPU-only hardware.
- The WebGPU toggle is reachable, so the adapter's `localDevice` input is no
  longer dead configuration.

### Negative

- Users with a working GPU must opt in on each new installation.
- `ollamaCpuOnly` is a tri-state in practice (absent / true / false) rather
  than a plain boolean, which the schema expresses as
  `.optional().default(true)`.

### Neutral

- The settings schema gains `localDevice`, so records written before this
  change backfill to `'wasm'` on load.

## Migration

No migration is required. Records that omit `ollamaCpuOnly` or `localDevice`
are backfilled by `StoredSettingsSchema` during parse; records that carry an
explicit value are preserved unchanged.
