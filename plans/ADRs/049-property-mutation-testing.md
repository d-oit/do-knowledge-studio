# ADR 049 — Bounded Property and Mutation Testing for Sync

**Date**: 2026-11-03

**Status**: Accepted; implementation tracked in Plan 194 / issue #1062

**Related**: Plan 194, ADR 027, ADR 028

## Context

Sync, migration, hydration, and cross-tab code has correctness conditions over
operation order and malformed persisted state. Example tests alone do not
systematically exercise those boundaries. The original 12-module Stryker run
also took 8h44m locally, so one GitHub Actions job cannot preserve the full
13-module mutation scope within the hosted-runner job limit.

## Decision

1. Use `fast-check` properties for merge idempotence and convergence, causal
   clocks, tombstone/delete arbitration, cross-tab recreation, migration
   preservation, and hydration quarantine. Keep the normal profile bounded to
   100 cases per property with fixed-seed replay; run 2,000 cases per property
   in the expanded scheduled profile.
2. Use the Stryker Vitest runner only for the 13 sync, hydration, migration, and
   cross-tab source files listed in `stryker.config.json`. Keep the Vitest
   related-test selection enabled. Exclude only generated skill-link trees that
   cannot be copied into Stryker's sandbox; do not narrow production or test
   scope to reduce runtime.
3. Run the expanded properties and mutation checks nightly and on demand. Run
   one configured mutation source file per matrix job, with a 240-minute job
   limit and four concurrent shards. Aggregate the reports and require every
   configured source file exactly once; missing, duplicate, or unexpected scope
   entries fail.
4. Set Stryker's per-shard display and break thresholds to zero. Enforce the
   single 60% global floor after aggregation using `(Killed + Timeout) / (Killed
   + Timeout + Survived + NoCoverage)`. Treat compile/runtime errors, ignored,
   pending, and unknown statuses as failures rather than excluding them from
   the score.
5. Keep per-module HTML/JSON reports and logs in a 14-day workflow artifact.
   Triage every surviving tombstone or causality mutant as a regression test or
   an evidence-backed equivalent in Plan 194.

## Consequences

- The mutation set stays complete while each shard remains below GitHub's
  documented 360-minute job maximum. Parallel shards trade wall-clock time for
  additional runner minutes.
- The full local mutation command remains expensive; contributors can use the
  bounded property profile and targeted Stryker `--mutate` option during normal
  iteration, while CI owns the complete scheduled run.
- Stryker timeouts count as detected according to its metric definition. The
  report checker rejects invalid and incomplete results so they cannot inflate
  the aggregate score.

## Verification

Plan 194 records the original full 12-module baseline, the updated 13-module
local composite (68.22%) and focused reconciliation, tombstone, and causality
results with survivor equivalence evidence. Property tests and the aggregation
unit tests pass locally. The full 13-module matrix must run after this workflow
reaches the default branch, where `workflow_dispatch` is available.

## Official references

- [Stryker mutant states and metrics](https://stryker-mutator.io/docs/mutation-testing-elements/mutant-states-and-metrics/)
- [Stryker Vitest runner](https://stryker-mutator.io/docs/stryker-js/vitest-runner/)
- [GitHub Actions workflow syntax](https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions)
- [download-artifact v8 README](https://raw.githubusercontent.com/actions/download-artifact/v8.0.2/README.md)
- [fast-check Vitest guide](https://fast-check.dev/docs/tutorials/setting-up-your-test-environment/property-based-testing-with-vitest/)
