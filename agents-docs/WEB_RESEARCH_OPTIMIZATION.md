# Web Research Optimization Guide

> How to maximize token efficiency, quality scores, and validation coverage when using the Web Doc Resolver in swarm workflows.

## Table of Contents

1. [Token Optimization Strategies](#token-optimization-strategies)
2. [Quality Scoring & Thresholds](#quality-scoring--thresholds)
3. [Link & Reference Validation](#link--reference-validation)
4. [Profile Selection Guide](#profile-selection-guide)
5. [Caching & Routing Memory](#caching--routing-memory)
6. [Performance Tuning](#performance-tuning)
7. [Deep Research Patterns](#deep-research-patterns)

---

## Token Optimization Strategies

### 1. Cascade Strategy (Free-First)

The resolver uses a **progressive cascade** that prioritizes free providers:

```
URL Resolution:
  Cache (0 tokens) → llms.txt (0 tokens) → Jina (0 tokens) 
  → Direct Fetch (0 tokens) → Firecrawl (paid) → Mistral Browser (paid)

Query Resolution:
  Cache (0 tokens) → Exa MCP (free tier) → DuckDuckGo (0 tokens)
  → Exa/Tavily (paid) → Serper (paid)
```

**Token Savings Strategy**:

```bash
# Configure cache aggressively
export WEB_RESOLVER_CACHE_TTL_DAYS=30  # 30-day cache
export WEB_RESOLVER_MAX_CHARS=8000     # Limit content size

# Use free profile for initial research
WEB_RESOLVER_PROFILE=free ./scripts/swarm-worktree-web-research.sh "topic"

# Upgrade to quality only for critical gaps
```

### 2. Content Size Optimization

| Setting | Tokens (est.) | Use Case |
|---------|---------------|----------|
| `MAX_CHARS=4000` | ~1000 tokens | Quick validation |
| `MAX_CHARS=8000` | ~2000 tokens | Standard analysis |
| `MAX_CHARS=12000` | ~3000 tokens | Deep research |

**Implementation**:

```python
# In your resolver calls
resolve_url(url, max_chars=4000, profile=Profile.FREE)  # Exploration
resolve_url(url, max_chars=8000, profile=Profile.QUALITY)  # Critical path
```

### 3. Batch Processing with Backpressure

```bash
# Control parallel resolution to avoid rate limits
batch_resolve queries.txt output_dir 3  # Max 3 parallel
```

**Rate Limiting Pattern**:
- Sleep every N requests (configurable)
- Circuit breaker: 3 failures → 300s cooldown
- Exponential backoff for retries

### 4. Negative Caching

Failed resolutions are cached to prevent wasted tokens:

```python
# Negative cache TTL: 1 hour (configurable)
# Prevents re-trying broken URLs
```

---

## Quality Scoring & Thresholds

### Quality Score Algorithm (0.0 - 1.0)

```python
base_score = content_quality_heuristics()

# Penalties:
too_short          → -0.35  # < MIN_CHARS
missing_links      → -0.15  # No references
duplicate_heavy    → -0.25  # >30% duplicate content
noisy_content      → -0.20  # High noise ratio
```

### Threshold Recommendations

| Use Case | Min Score | Action |
|----------|-----------|--------|
| Quick research | 0.5 | Accept with warning |
| Standard analysis | 0.7 | Review if below |
| Production docs | 0.85 | Reject if below |
| API references | 0.9 | Strict validation |

### Context-Aware Scoring

```python
# API Documentation: Validate endpoints, schemas
def validate_api_docs(content: str) -> float:
    score = base_quality_score(content)
    if has_endpoint_definitions(content):
        score += 0.1
    if has_code_examples(content):
        score += 0.1
    return min(score, 1.0)

# Tutorials: Check for completeness
def validate_tutorial(content: str) -> float:
    score = base_quality_score(content)
    sections = ['introduction', 'prerequisites', 'steps', 'conclusion']
    for section in sections:
        if has_section(content, section):
            score += 0.05
    return min(score, 1.0)
```

---

## Link & Reference Validation

### Full Validation Pipeline

```python
validation_results = {
    "all_links_valid": True,
    "broken_links": [],
    "redirects": [],
    "external_refs": [],
    "citation_completeness": 0.0
}
```

### Validation Levels

| Level | Checks | Use Case |
|-------|--------|----------|
| `basic` | URL format, reachable | Quick sanity |
| `standard` + content hash | Research |
| `strict` | + content hash, citation match | Production |
| `full` | + all above + cross-reference | Compliance |

### Implementation

```bash
# Enable full validation
python -m scripts.resolve "https://docs.example.com" \
  --validate-links \
  --validation-level strict \
  --check-citations \
  --cross-reference
```

### Citation Extraction

```python
# Extract and validate inline citations
extracted_citations = extract_citations(content)
validated_citations = [
    c for c in extracted_citations 
    if validate_citation(c) is True
]

citation_score = len(validated_citations) / len(extracted_citations)
```

---

## Profile Selection Guide

### Profile Comparison

| Profile | Providers | Paid | Latency | Quality | Best For |
|---------|-----------|------|---------|---------|----------|
| `free` | 3 | 0 | 6s | 0.70 | Initial exploration |
| `fast` | 2 | 1 | 4s | 0.60 | Quick answers |
| `balanced` | 4-6 | 1-2 | 9-12s | 0.65 | Standard work |
| `quality` | 6-10 | 3-5 | 15-20s | 0.85 | Critical analysis |

### Decision Tree

```
Is this initial exploration?
├─ Yes → Use FREE profile
└─ No → Is it time-sensitive?
    ├─ Yes → Use FAST profile
    └─ No → Is it production-critical?
        ├─ Yes → Use QUALITY profile
        └─ No → Use BALANCED profile
```

### Hybrid Profile Strategy

```python
# Multi-phase research
phase1_queries = [...]  # Exploration
phase1_results = batch_resolve(phase1_queries, profile=Profile.FREE)

# Identify high-value sources from phase 1
critical_urls = [r.url for r in phase1_results if r.score > 0.8]

# Deep dive on critical sources
phase2_results = [resolve_url(u, profile=Profile.QUALITY) for u in critical_urls]
```

---

## Caching & Routing Memory

### Layered Memory System

```python
# 1. Request Cache (in-memory, per-session)
# 2. Routing Memory (TTL-based, 30 days default)
# 3. Negative Cache (failed requests)
# 4. LLM Response Cache (synthesized content)
```

### Routing Memory Features

```python
routing_memory.record_success(
    url=url,
    provider="jina",
    quality_score=0.92,
    latency_ms=450
)

# Future resolutions for same domain
# will prioritize the successful provider
```

### TTL Configuration

```bash
# Freshness vs. token savings tradeoff
export ROUTING_MEMORY_TTL_DAYS=7    # Weekly refresh
export ROUTING_MEMORY_TTL_DAYS=30   # Monthly (default)
export ROUTING_MEMORY_TTL_DAYS=90   # Quarterly for stable docs
```

### Cache Warming

```bash
# Pre-populate cache for common queries
./scripts/warm_cache.sh queries.txt
```

---

## Performance Tuning

### Parallel Resolution

```python
# Optimal parallelism by provider type
PROVIDER_PARALLEL_LIMITS = {
    "jina": 5,              # High rate limit
    "exa": 3,               # Moderate
    "firecrawl": 2,         # Resource intensive
    "mistral_browser": 1,   # Slow/heavy
}
```

### Circuit Breaker Pattern

```python
# Automatic failover
if provider_failures > 3:
    circuit_breaker.open(provider, cooldown=300)
    # Next requests skip this provider for 5 minutes
```

### Timeout Tuning

| Provider | Timeout | Retry |
|----------|---------|-------|
| llms.txt | 5s | 1 |
| Jina | 15s | 2 |
| Firecrawl | 30s | 2 |
| Mistral Browser | 60s | 1 |

### Latency Budgets

```python
PROFILE_BUDGETS = {
    "free": {"max_total_latency_ms": 6000},
    "fast": {"max_total_latency_ms": 4000},
    "balanced": {"max_total_latency_ms": 12000},
    "quality": {"max_total_latency_ms": 20000},
}
```

---

## Deep Research Patterns

### Pattern 1: Iterative Deep Dive

```python
# Start broad, go deep
iteration = 0
max_iterations = 3
current_urls = seed_urls

while iteration < max_iterations:
    # Resolve current level
    results = [resolve_url(u) for u in current_urls]
    
    # Extract links for next level
    next_urls = []
    for r in results:
        if r.score > 0.8:
            next_urls.extend(extract_links(r.content))
    
    # Quality filter
    current_urls = filter_by_quality(next_urls, min_score=0.75)
    iteration += 1
```

### Pattern 2: Cross-Validation

```python
# Verify facts across multiple sources
def cross_validate(fact: str, sources: List[str]) -> ValidationResult:
    confirmations = 0
    contradictions = []
    
    for source in sources:
        content = resolve_url(source).content
        if contains_fact(content, fact):
            confirmations += 1
        elif contradicts_fact(content, fact):
            contradictions.append(source)
    
    return ValidationResult(
        confidence=confirmations / len(sources),
        contradictions=contradictions
    )
```

### Pattern 3: Recency-Weighted Search

```python
# Prioritize recent information
results = resolve_query("framework updates 2024")
sorted_results = sorted(
    results,
    key=lambda r: (r.recency_score, r.quality_score),
    reverse=True
)
```

### Pattern 4: Semantic Clustering

```python
# Group similar content to avoid redundancy
clusters = semantic_cluster(results, threshold=0.85)
representative = [pick_best(c) for c in clusters]
# Reduces token usage by ~40%
```

---

## Swarm Integration Patterns

### Agent 1: Research Gatherer

```python
# Maximize coverage with free providers
def gather_research(topic: str) -> List[ResolvedResult]:
    queries = generate_queries(topic)
    
    # Use free profile for broad coverage
    return batch_resolve(queries, profile=Profile.FREE, max_parallel=5)
```

### Agent 2: Quality Validator

```python
# Deep validation on critical sources
def validate_research(results: List[ResolvedResult]) -> ValidationReport:
    critical = [r for r in results if r.priority == "high"]
    
    # Use quality profile for validation
    validated = [
        resolve_url(r.url, profile=Profile.QUALITY, validate_all=True)
        for r in critical
    ]
    
    return generate_validation_report(validated)
```

### Agent 3: Token Optimizer

```python
# Analyze and optimize token usage
def optimize_tokens(research_dir: str) -> OptimizationReport:
    summary = analyze_research_summary(research_dir)
    
    return OptimizationReport(
        cache_hit_rate=summary.cache_hit_rate,
        paid_usage_rate=summary.paid_usage_rate,
        estimated_savings=summary.cache_hits * 2000,
        recommendations=[
            "Increase cache TTL for stable docs",
            "Use free profile for exploratory queries",
            "Batch similar queries together"
        ]
    )
```

---

## Metrics & Reporting

### Key Metrics to Track

| Metric | Target | Measurement |
|--------|--------|-------------|
| Cache hit rate | >60% | `cache_hits / total_requests` |
| Quality score | >0.75 avg | Average of all results |
| Token savings | >40% | `(cache_hits * avg_tokens) / total_tokens` |
| Resolution time | <15s avg | Mean latency |
| Link validity | >95% | `valid_links / total_links` |

### Sample Report

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "total_queries": 50,
  "cache_hit_rate": 0.68,
  "average_quality_score": 0.82,
  "paid_usage_rate": 0.24,
  "estimated_tokens_saved": 68000,
  "average_latency_ms": 8400,
  "link_validation_rate": 0.97,
  "top_sources": ["jina", "llms_txt", "exa"],
  "failed_resolutions": 2
}
```

---

## Best Practices Checklist

### Before Research

- [ ] Define clear research questions
- [ ] Choose appropriate profile for phase
- [ ] Set quality thresholds
- [ ] Configure cache TTL
- [ ] Plan validation strategy

### During Research

- [ ] Monitor cache hit rates
- [ ] Check quality scores in real-time
- [ ] Validate high-priority sources
- [ ] Track token usage
- [ ] Log unexpected failures

### After Research

- [ ] Validate all citations
- [ ] Cross-check critical facts
- [ ] Remove duplicate content
- [ ] Generate quality report
- [ ] Update routing memory

---

## Troubleshooting

### Low Cache Hit Rate

```bash
# Check cache configuration
echo $WEB_RESOLVER_CACHE_TTL_DAYS
echo $ROUTING_MEMORY_TTL_DAYS

# Warm cache for common queries
./scripts/warm_cache.sh
```

### Poor Quality Scores

```python
# Switch to higher profile
profile = Profile.QUALITY

# Increase max_chars for better content
max_chars = 12000

# Enable stricter validation
validate_all = True
```

### Rate Limiting

```bash
# Reduce parallelism
export MAX_PARALLEL=2

# Add delays between batches
export BATCH_DELAY_MS=5000
```

---

## References

- `SKILL.md` - Main resolver documentation
- `scripts/routing.py` - Budget-aware routing
- `scripts/quality.py` - Quality scoring algorithms
- `scripts/routing_memory.py` - TTL-based memory
- `.opencode/commands/web-research.md` - Command reference
