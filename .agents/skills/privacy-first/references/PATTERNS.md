# Email Detection Patterns

## Regex Patterns

### Basic Email
```
[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}
```

### Common TLDs (stricter)
```
[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(com|org|io|net|edu|gov|co)
```

## File Extensions to Scan

| Extension | Priority | Notes |
|-----------|----------|-------|
| `.py` | High | Code files |
| `.toml` | High | Config/metadata |
| `.yaml` / `.yml` | High | CI/CD configs |
| `.json` | High | Package configs |
| `.md` | High | Documentation |
| `.js` / `.ts` | Medium | Frontend code |
| `.rs` | Medium | Rust code |
| `.go` | Medium | Go code |

## Exclusion Patterns

These patterns are allowed and should NOT trigger errors:

```
# Test domains (RFC 2606)
example.com
example.org
example.net
test.com

# Localhost (common in dev)
localhost

# Git directories
.git/

# Node modules
node_modules/

# Build outputs
dist/
build/
target/
```

## Project-Specific Patterns to Flag

Replace these patterns when found:

| Pattern | Replace With |
|---------|--------------|
| `support@*` | GitHub Issues link |
| `contact@*` | GitHub Issues link |
| `help@*` | GitHub Issues link |
| `info@*` | GitHub Issues link |
| `email = "..."` | Remove field |
| `Author: ... <email>` | `Author: ...` |
| `mailto:user@*` | GitHub Issues link |

## Quick Validation Command

```bash
# Full scan (run from repo root)
grep -rE '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' \
  --include="*.py" --include="*.toml" --include="*.yaml" --include="*.json" --include="*.md" \
  . 2>/dev/null | grep -vE 'example\.(com|org|net)|test\.com|localhost|\.git/'
```
