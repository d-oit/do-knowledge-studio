### LESSON-052: A fix that makes the failing test pass can still break a shared resource

The failing test is evidence about **one** symptom. It says nothing about the
mechanism that produced it, so a fix that removes the mechanism also makes it
pass.

Observed 2026-10-21 on the semantic-search embedder: a query that hung
because the runtime cached the *promise* of a model load, and a load that
never settles stayed cached forever. The first fix dropped the cached promise
when a query was aborted. The test passed. It also:

- evicted an **already-loaded** model, so the next query re-downloaded ~25 MB
  (measured: the pipeline call count went 1 → 2 across an abort with a warm
  model);
- broke the lazy-singleton contract, because the load is not cancellable, so
  dropping the cache started a **second** concurrent load whose failure path
  could wipe the first load's state;
- under debounced typing, turned every superseded keystroke into its own
  download (5 queries → 1 call was the target; the broken version made it 5).

The review found it; the test did not, because the test only asserted the
symptom was gone.

The countermeasure is a **measurement the reviewer can check**, not a
reasoning exercise: *a warm resource survives the operation*, *N superseded
callers start one load, not N*. A count that goes the wrong way is the
finding. The second fix — bounding the load instead of evicting the cache —
passed both.

**Tags**: #verification #testing #regression #shared-state #review

---
