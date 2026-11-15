## LESSON-039: Name the tool from Codacy's own API, not from the `nosemgrep` comment

**Date**: 2026-09-26
**Component**: CI / static analysis
**Severity**: Medium

**What happened**: A Codacy SSRF finding survived six inline-suppression
variants and two PRs. I spent the whole effort reasoning about Semgrep, because
the suppression comment said `nosemgrep` and my config attempt targeted
`engines.semgrep.disable_rules`. The actual tool was **Opengrep** — obtained
in one call from `codacy pull-request ... --output json`, which reports
`toolInfo.name` and a numeric `resultDataId` per issue. The working fix was
`--ignore-issue <resultDataId> --ignore-reason FalsePositive`, which clears the
gate immediately and needs no config change.

**Root cause**: I inferred the analysis tool from a suppression comment's
namespace instead of asking the API that owns the finding. The `rules.lgpl.*`
namespace is shared, so the comment gave no reliable signal about which engine
reported it.

**Prevention**:

- Before reasoning about a Codacy finding, run the `codacy` skill's Cloud CLI
  and read `toolInfo.name` plus `resultDataId`. That is two fields and it ends
  the guesswork.
- `.codacy.yml` `disable_rules` did not help here, and AGENTS.md already says
  config suppressions do not cover new PR code (LESSON-031, plans/112) — read
  that before reaching for a config edit.
- The `static-analysis-suppression` decision tree is: fix code, then suppress
  per-issue, and only then consider config or an admin merge.

**Tags**: #ci #codacy #opengrep #static-analysis #suppression

---
