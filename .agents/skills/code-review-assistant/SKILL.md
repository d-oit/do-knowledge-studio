---
name: code-review-assistant
description: Automated code review with PR analysis, change summaries, and quality checks. Use for reviewing pull requests, generating review comments, checking against best practices, and identifying potential issues. Includes style guide compliance, security issue detection, and review automation.
license: MIT
---

# Code Review Assistant

Automated code review with intelligent analysis of changes, quality checks, and actionable feedback generation.

## When to Use

- **Reviewing pull requests** - Analyze diffs and provide feedback
- **Change summarization** - Generate PR descriptions from code changes
- **Quality checks** - Style guide compliance, best practices
- **Security review** - Detect potential security issues in changes
- **Review automation** - Auto-approve simple changes, flag complex ones
- **Learning tool** - Explain changes for knowledge sharing

## Core Workflow

### Phase 1: Change Analysis
1. **Identify modified files** - Categorize by type and risk level
2. **Calculate metrics** - Lines changed, complexity delta, test coverage
3. **Detect patterns** - New features, bug fixes, refactoring, dependencies
4. **Assess risk** - Critical paths, public APIs, security-sensitive areas

### Phase 2: Quality Assessment
1. **Style compliance** - Check against project style guide
2. **Best practices** - Design patterns, code organization
3. **Test coverage** - Verify tests accompany changes
4. **Documentation** - Check for necessary doc updates
5. **Security scan** - Identify potential vulnerabilities

### Phase 3: Feedback Generation
1. **Summarize changes** - High-level description of what changed
2. **Identify issues** - Bugs, anti-patterns, performance concerns
3. **Suggest improvements** - Refactoring opportunities, optimizations
4. **Highlight positives** - Good practices to reinforce
5. **Generate review comments** - Specific, actionable feedback

## File Risk Assessment

| Risk Level | Patterns | Examples |
|------------|----------|----------|
| **Critical** | Auth, security, payment | `**/auth/**`, `**/security/**`, `**/payment/**` |
| **High** | API, models, database | `**/api/**`, `**/models/**`, `**/database/**` |
| **Medium** | Services, utils | `**/services/**`, `**/helpers/**` |
| **Low** | Tests, docs | `**/tests/**`, `**/*.md` |

## Change Metrics

| Metric | Threshold | Action |
|--------|-----------|--------|
| **Files Changed** | > 20 | Extra review needed |
| **Lines Changed** | > 500 | Consider splitting PR |
| **Complexity Delta** | +10 | Needs scrutiny |
| **Test Coverage** | < 80% | Flag for tests |
| **TODO/FIXME** | > 3 | Needs triage |

## Quality Checks

### Style Violations
```python
# Common patterns to check
STYLE_CHECKS = {
    'python': [
        ('line_length', r'.{101,}'),
        ('missing_docstrings', r'^def (?!__).*:\n(?!\s*""")'),
    ],
    'javascript': [
        ('console_logs', r'console\.(log|debug)'),
        ('var_usage', r'\bvar\s+'),
    ],
}
```

### Security Patterns
```python
SECURITY_CHECKS = [
    ('hardcoded_secrets', r'(password|secret|key)\s*=\s*["\'][^"\']+'),
    ('sql_injection', r'execute\s*\([^)]*%'),
    ('unsafe_eval', r'eval\s*\('),
]
```

## Review Comment Templates

### Issue Template
```
**Issue**: {description}

**Suggestion**: {suggestion}

**Why**: {explanation}
```

### Praise Template
```
✨ **Nice!** {description}

This {practice} improves {benefit}.
```

## GitHub Integration

See `references/github-integration.md` for API usage, auto-approval criteria, and webhook setup.

## Auto-Approve Criteria

```python
AUTO_APPROVE_CRITERIA = {
    'max_files': 5,
    'max_lines': 100,
    'no_critical_files': True,
    'test_coverage_threshold': 80,
    'no_severity_blocking': True,
}
```

## Review Summary Template

```markdown
## Code Review Summary

### 📊 Change Overview
- **Files Changed**: {file_count}
- **Lines Modified**: +{additions}/-{deletions}
- **Risk Level**: {risk_level}
- **Estimated Review Time**: {review_time} minutes

### ⚠️ Issues Found
{issues_table}

### ✅ Positive Observations
{positive_observations}

### 🏁 Review Decision
**{decision}** - {decision_reason}
```

## CI Integration

```yaml
name: Automated Code Review

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Run Code Review Assistant
        uses: ./.github/actions/code-review
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

## Quality Checklist

- [ ] All new code has corresponding tests
- [ ] No hardcoded secrets or credentials
- [ ] Security-sensitive code properly reviewed
- [ ] Documentation updated for API changes
- [ ] Error handling added for new code paths
- [ ] Performance implications considered
- [ ] Style guide compliance verified
- [ ] No debugging code left in (console.log, print)
- [ ] Meaningful commit messages
- [ ] Breaking changes documented

## References

- `references/github-integration.md` - GitHub API integration
- `references/security-patterns.md` - Security review patterns
- `references/style-guides.md` - Common style guide configurations
