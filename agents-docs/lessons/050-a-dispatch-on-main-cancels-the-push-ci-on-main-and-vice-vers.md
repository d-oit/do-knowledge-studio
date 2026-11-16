### LESSON-050: A dispatch on `main` cancels the push CI on `main`, and vice versa

`ci-and-labels.yml` (workflow name "CI") runs on both `push` and
`workflow_dispatch` with a ref-keyed concurrency group and cancel-in-progress, so
the two triggers **cancel each other**: dispatch a manual sweep while the push
run for the head commit is still in flight and the push run dies as `cancelled`;
push a merge during a sweep and the sweep dies instead. Both observed on
2026-10-16 — run 38948162016 was killed by the `c124a85` push, and
38950253979 was killed by the sweep dispatch on the same ref.

- `cancelled` is not `failed`: `gh run watch --exit-status` exits 1 for both —
  read `--json conclusion` before diagnosing.
- The cheap repair is `gh run rerun <id>` on the cancelled run. A rerun creates
  **no new Vercel deployment** (Vercel watches pushes, not Actions), so it is
  free even under the Hobby deployment cap (LESSON-049).
- Sequence a dispatch *after* the push run settles, or expect to rerun one of
  the two.

**Tags**: #ci #concurrency #dispatch #verification

---
