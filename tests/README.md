# Shell Test Suite (BATS)

Regression tests for shell scripts, written with
[bats-core](https://bats-core.readthedocs.io/). Run the whole suite with:

```bash
bats tests/
```

`scripts/verify.sh` also runs the suite ("Shell Tests (BATS)") plus a
`shellcheck --shell=bats` lint pass. CI runs both through the quality gate
(`quality_gate.sh`) — the runner installs bats first, see
`ci-and-labels.yml` and LESSON-029.

## Layout

- `tests/*.bats` — one test file per script under test.
- `tests/helpers/` — shared helpers, sourced with `load helpers/<name>`
  (e.g. the mocked-`gh` harness in `mock-gh.bash`).

## Conventions

- **Declare the minimum bats version.** Any file using `run !` must start
  with `bats_require_minimum_version 1.5.0`. Without it, bats does not
  parse `!` as a flag (BW02) and instead tries to execute `!` as a
  command (status 127), silently corrupting the assertion.
- **Never assert absence with bare `! command`.** Per SC2314, `!` does
  not fail a bats test (errexit negation exemption), so the assertion is
  vacuous. Use `run ! grep ...` instead: bats 1.10's `run` returns 1 when
  the command unexpectedly succeeds (status 0) and leaves `$status`
  unnegated — do not check `$status` afterwards.
- **Mock external CLIs** (e.g. `gh`) with an exported function driven by
  `MOCK_*` env vars. Record every invocation to a `$MOCK_LOG` and assert
  the exact call lifecycle (see `tests/helpers/mock-gh.bash`).
- **Keep tests hermetic.** Use `$BATS_TEST_TMPDIR` (per-test) for scratch
  files and reset exported state in `setup()`.

## Adding a suite

Follow `tests/diagnose-merge-state.bats`: derive the script path from
`$BATS_TEST_DIRNAME`, `load` the helper, export env in `setup()`, then
write one `@test` per behavior. Run
`shellcheck --shell=bats -S warning` on the new file before committing —
`scripts/verify.sh` enforces it.
