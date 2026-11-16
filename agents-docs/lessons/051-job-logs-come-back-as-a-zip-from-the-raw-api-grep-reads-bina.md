### LESSON-051: Job logs come back as a ZIP from the raw API — grep reads binary

`gh api repos/{owner}/{repo}/actions/jobs/{id}/logs` returns a redirect to a
**ZIP archive** (the HTTP client follows it and prints bytes), so `grep` on that
output finds nothing and exits 1. A zero-count grep here is indistinguishable
from "the spec never ran", and it nearly passed as evidence of exactly that. Use
`gh run view --job <id> --log`, which decodes the archive to text, when the
question is "did this test actually execute".

**Tags**: #gh #logs #verification

---
