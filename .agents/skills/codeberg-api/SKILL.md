---
name: codeberg-api
description: >-
  Interact with Forgejo/Codeberg repositories via the REST API — read or write
  files, manage issues, create pull requests, list branches/tags, search repos,
  and automate CI/CD workflows. Use this skill when the user wants to: read file
  contents from a Forgejo repo, create or update files, manage issues (create,
  list, close), list repositories for a user, search, set up Forgejo Actions
  workflows, or automate any git-forge operation. Works without authentication
  for public repos; requires FORGEJO_TOKEN for private repos and write operations.
license: MIT
compatibility: Requires Python 3.10+, httpx or requests. Needs FORGEJO_TOKEN env var for write operations.
allowed-tools: Bash(python:*|curl:*) Read
metadata:
  author: d.o.
  version: "1.0"
  spec: "agentskills.io"
  triggers:
    - forgejo
    - codeberg
    - forgejo issue
    - forgejo pr
    - forgejo branch
    - forgejo repo
    - forgejo actions
---

# Forgejo/Codeberg API Skill

Automates Forgejo repository operations using the REST API (v1).
Compatible with Codeberg and self-hosted Forgejo instances.

## When to use this skill

Activate when you need to:
- Read or write files in a Forgejo/Codeberg repository
- Create/update/close issues or pull requests
- List branches, tags, commits, or releases
- Search repositories or users
- Trigger CI/CD via repository dispatch
- Automate any git-forge operation

## Prerequisites

```bash
pip install httpx python-dotenv
```

### Authentication

Set `FORGEJO_TOKEN` (or `CODEBERG_TOKEN`) in your environment or `.env` file.
Generate at: **Forgejo/Codeberg → Settings → Applications → Generate Token**.

Required scopes per operation:
| Operation | Scope needed |
|-----------|-------------|
| Read public repos | (none, token optional) |
| Read private repos | `read:repository` |
| Write files / create PRs | `write:repository` |
| Manage issues | `write:issue` |
| Read user info | `read:user` |

```bash
export FORGEJO_TOKEN=your_token_here
# or place in .env at project root
```

### Base URL Configuration

The skill defaults to Codeberg (`https://codeberg.org/api/v1`). For self-hosted
Forgejo instances, set `FORGEJO_BASE_URL`:

```bash
export FORGEJO_BASE_URL=https://forgejo.example.com/api/v1
```

## Base URL & Headers

```
Base URL : https://codeberg.org/api/v1 (default)
Auth     : Authorization: token <FORGEJO_TOKEN>
Content  : Content-Type: application/json
```

## Commands

### CLI Usage (from project root)

```bash
# List repos for a user
python .agents/skills/codeberg-api/scripts/forgejo_api.py repos --owner username

# Get file contents
python .agents/skills/codeberg-api/scripts/forgejo_api.py get-file \
  --owner username --repo myrepo \
  --path README.md --branch main

# Create an issue
python .agents/skills/codeberg-api/scripts/forgejo_api.py create-issue \
  --owner username --repo myrepo \
  --title "Bug: xyz" --body "Description"

# List open issues
python .agents/skills/codeberg-api/scripts/forgejo_api.py list-issues \
  --owner username --repo myrepo --state open

# Create or update a file
python .agents/skills/codeberg-api/scripts/forgejo_api.py put-file \
  --owner username --repo myrepo \
  --path docs/test.md --content "# Hello" \
  --message "docs: add test file" --branch main
```

### Standalone Usage (from skill directory)

```bash
cd .agents/skills/codeberg-api
python scripts/forgejo_api.py --help
```

## Common API Patterns

### Read a file

```bash
curl -H "Authorization: token $FORGEJO_TOKEN" \
  "https://codeberg.org/api/v1/repos/{owner}/{repo}/contents/{filepath}?ref=main"
```

Response contains `content` (base64-encoded) and `sha` (needed for updates).

### Create/update a file

```bash
curl -X PUT -H "Authorization: token $FORGEJO_TOKEN" \
  -H "Content-Type: application/json" \
  "https://codeberg.org/api/v1/repos/{owner}/{repo}/contents/{filepath}" \
  -d '{"message":"commit msg","content":"<base64>","sha":"<existing_sha_or_omit>"}'
```

### Create an issue

```bash
curl -X POST -H "Authorization: token $FORGEJO_TOKEN" \
  -H "Content-Type: application/json" \
  "https://codeberg.org/api/v1/repos/{owner}/{repo}/issues" \
  -d '{"title":"Issue title","body":"Body text"}'
```

### List branches

```bash
curl "https://codeberg.org/api/v1/repos/{owner}/{repo}/branches"
```

## Error Handling

| HTTP Status | Meaning | Action |
|-------------|---------|--------|
| 401 | Unauthorized | Check FORGEJO_TOKEN |
| 403 | Forbidden | Check token scopes |
| 404 | Not found | Verify owner/repo/path |
| 409 | Conflict | SHA mismatch on file update — fetch current SHA first |
| 422 | Validation error | Check request body fields |
| 429 | Rate limited | Wait and retry with backoff |

## Forgejo Actions (CI/CD)

Forgejo uses **Forgejo Actions** for CI/CD, fully compatible with GitHub Actions.

### Workflow Location
Place workflows in `.forgejo/workflows/` directory.

### Example: Build Workflow

```yaml
name: Build
on: [push, pull_request]
jobs:
  build:
    runs-on: docker
    steps:
      - uses: actions/checkout@v4
      - name: Run tests
        run: npm test
      - name: Build
        run: npm run build
```

### Best Practices (2026)
- Use **matrix builds** for parallel testing
- Enable **caching** for dependencies
- Use **branch protection** with required workflows
- Leverage **secrets** for API tokens (`FORGEJO_TOKEN`)

## Bundled Scripts

- `scripts/forgejo_api.py` — Main CLI tool for Forgejo API operations

## References

- `agents-docs/AVAILABLE_SKILLS.md` - Skill authoring guide