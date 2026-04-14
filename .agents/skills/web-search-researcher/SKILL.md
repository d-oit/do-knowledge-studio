---
name: web-search-researcher
description: Research topics using web search to find accurate, current information. Use when you need modern information, official documentation, best practices, or technical solutions beyond training data.
---

# Web Search Research

Find accurate, relevant information from web sources.

## When to Use

- Modern information not in training data
- Official documentation for APIs/libraries
- Best practices and recommendations
- Technical solutions
- Technology comparisons

## Date Context

**CRITICAL**: Check `<env>` for current date.
- Include current year in searches
- Evaluate freshness (12-18 months = recent)

## Core Process

### 1. Analyze Query
Identify key terms, source types, search angles.

### 2. Strategic Searches
- Start broad, refine
- Multiple variations
- Site-specific searches

### 3. Fetch Content
- WebFetch promising results
- Prioritize official docs
- Note publication dates

### 4. Synthesize
- Organize by relevance
- Include quotes with links
- Note gaps/conflicts

## Search Strategies

### API Documentation
```
"[library] official docs [feature]"
site:docs.stripe.com webhook
```

### Best Practices
```
"Rust async" best practices 2026
```

### Technical Solutions
```
"tokio panic" redb write
site:github.com tokio spawn_blocking
```

### Comparisons
```
"redb vs sled" performance
```

## Progressive Strategy

**Round 1 (5 min)**: 1-2 broad searches. If official docs → stop.

**Round 2 (10 min)**: 2-3 specific searches, fetch 2-3 sources. If consensus → stop.

**Round 3 (15 min)**: Fill gaps, synthesize.

**Rule**: Most complete in Round 2.

## Source Priority

**⭐⭐⭐ Fetch First**: Official docs, GitHub maintainers, recent experts

**⭐⭐ Fetch If Needed**: Expert blogs, high-vote SO, conference talks

**⭐ Skip**: Generic tutorials, old posts, no author

**🚫 Never**: AI farms, aggregators

## Search Operators

| Operator | Example |
|----------|---------|
| `"exact"` | `"async runtime"` |
| `-term` | `rust -game` |
| `site:` | `site:docs.rs` |
| `after:` | `async after:2024` |

## Output Format

```markdown
## Summary
[2-3 sentences]

## Findings

### [Source 1]
**Source**: [Link]
**Key Info**:
- Quote/finding

### [Source 2]
**Source**: [Link]
**Key Info**:
- Finding

## Resources
- [Link] - Description

## Gaps
[What not found]
```

## Quality Guidelines

- **Accuracy**: Quote with links
- **Relevance**: Focus on query
- **Currency**: Note dates, prefer recent
- **Authority**: Official first
- **Transparency**: Note gaps/conflicts

## Depth Levels

| Level | Time | Use For |
|-------|------|---------|
| Quick | 15-20min | Simple facts |
| Standard | 30-45min | Best practices |
| Deep | 60-90min | Architecture |
| Exhaustive | 2+hr | Critical |

**Rule**: Set timer, synthesize when expires.

## Workflow

1. **Plan**: Query, concepts, searches
2. **Execute**: Run searches, identify URLs
3. **Fetch**: WebFetch 3-5 sources
4. **Synthesize**: Organize, use format
5. **Evaluate**: Stop if consensus, official found
6. **Report**: Present with limitations

## Examples

### API Research
**Query**: "Stripe webhook signature"
**Searches**: Official docs, site:stripe.com
**Output**: Docs link, code example

### Best Practices
**Query**: "Rust async error handling"
**Searches**: "best practices 2026", site:blog.rust-lang.org
**Output**: Official book, expert blogs

### Problem Solving
**Query**: "Tokio blocking redb"
**Searches**: "tokio blocking", site:github.com
**Output**: spawn_blocking solution

## Integration

- **feature-implement**: Research before
- **debug-troubleshoot**: Find patterns
- **do-web-doc-resolver**: Fetch URLs

## Best Practices

### DO:
✓ Check date context
✓ Use current year
✓ Specific terms
✓ Official docs first
✓ Cross-reference
✓ Provide links

### DON'T:
✗ Stop at first result
✗ Trust unverified
✗ Ignore dates
✗ Omit attribution

## Troubleshooting

**Poor results**: Refine terms, try keywords, site-specific

**Outdated**: Add year, check changelog

**Conflicting**: Check dates, authority, note all

**None**: Broaden, alternatives, report gap

## Summary

Analyze, Search strategically, Fetch authoritative, Synthesize with attribution.

## Reference Files

- **[references/guide.md](references/guide.md)** - Complete guide with strategies, rounds, operators, depth levels, workflow, and examples
