### LESSON-015: GitHub API 403 Errors in Generic Templates

**Date**: 2026-04-04
**Component**: CI/CD / GitHub API / Token Permissions
**Severity**: High

**Issue**: CI job fails with "HTTP 403: Resource not accessible by integration" when calling GitHub API.

**Symptoms**:
- `gh label create` or similar commands fail with 403
- Job fails even with `GITHUB_TOKEN` set
- Works locally with personal access token
- Fails in pull requests from forks

**Root Cause**:
1. **Default Token Permissions**: `secrets.GITHUB_TOKEN` has read-only by default for security
2. **Missing Permissions Key**: Workflow didn't explicitly request `issues: write` permission
3. **Operation Requirements**: Creating labels via API requires `issues: write` permission (not just `pull-requests: write`)

**Solution** (Verified Working):
```yaml
# Add explicit permissions at job level
jobs:
  labels:
    runs-on: ubuntu-latest
    permissions:
      issues: write    # Required for creating labels
    steps:
      - run: gh label create "bug" --color d73a4a
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Alternative Approaches**:
- Use Personal Access Token (PAT) with full repo scope (less secure)
- Use GitHub App token (most secure for orgs)
- Pre-create labels manually (simplest for static sets)

**Prevention**:
- Always check GitHub API permission requirements for operations
- Use `permissions:` key to explicitly request needed scopes
- Reference official docs: <https://docs.github.com/en/rest/issues/labels>
- Test workflows in PR before merging to main

**Tags**: #github-api #permissions #token #issues-write #ci

**Files Modified**:
- `.github/workflows/ci-and-labels.yml` - Add `permissions: issues: write`

**References**:
- GitHub Actions labeler shows exact permission requirements
- Community Discussion #60820 on 403 errors
- REST API docs: POST /repos/{owner}/{repo}/labels requires issues:write

---

---
