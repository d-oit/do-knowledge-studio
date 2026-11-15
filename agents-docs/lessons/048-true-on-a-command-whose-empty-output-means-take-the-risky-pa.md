### LESSON-048: `|| true` on a command whose empty output means "take the risky path" is fail-open

The Vercel skip script computed its changed-file list with
`changed="$(git diff … || true)"`. A *failed* diff — a commit absent from Vercel's
`--depth=10` clone, an unreadable tree — produced an empty string, which the next
check read as "nothing changed" and answered with **exit 0: skip the build**,
serving the previous deployment. The script's own comment claimed the opposite
("anything unknown builds"), and its test suite stayed green because it covered an
unknown *previous* commit but never an unknown *current* one.

Two habits follow. First, capture the exit status when empty output has meaning:
`if ! out="$(cmd)"; then echo …; exit 1; fi`. Second, when you document a
fail-closed boundary, test **both** ends of it — the suite will happily prove the
half you thought of.

**Tags**: #shell #ci #deployment #verification

---
