# 08 - Perplexity Skill & Agent Removal

## Task
Delete all Perplexity-related skills and agent configurations from the repository.

## Reason for Removal
- Replace Perplexity functionality with existing `do-web-doc-resolver` or `web-search-researcher` skills.
- Reduce redundant tooling and adhere to local-first principles.
- Align with internal best practices for web research/search.

## Files to Delete
No Perplexity-related files were found in the repository (verified via `glob **/*perplexity*`):
- No `.agents/skills/perplexity/` directory
- No `.agents/agents/perplexity-agent.md` file
- No other Perplexity references found

## Verification Steps
1. Run `grep -r "perplexity" /home/do/git/d-oit/do-knowledge-studio --include="*.md"` to confirm no remaining references.
2. Verify `do-web-doc-resolver` and `web-search-researcher` skills are functional as replacements.
3. Ensure no symlinks to Perplexity skill exist in `.agents/skills/`.

## Outcome
No action required — Perplexity tooling is not present in the repository.
