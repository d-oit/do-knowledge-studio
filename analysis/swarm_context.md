# Swarm Analysis Context

**Topic**: Optimizing Web Research Usage in Multi-Agent Swarms
**Objective**: Maximize token efficiency, quality scores, and validation coverage
**Worktree**: swarm-analysis-1775291938
**Timestamp**: 2024-04-04T08:38:00Z

## Web Research Optimization Strategy

### Profile Configuration
- **Primary Profile**: `quality` (10 providers, 5 paid attempts max)
- **Fallback Profile**: `balanced` (6 providers, 2 paid attempts)
- **Exploration Profile**: `free` (3 providers, 0 paid)
- **Quality Threshold**: 0.75 minimum score
- **Link Validation**: Full (all URLs validated)
- **Cache TTL**: 30 days

### Token Optimization Strategy

1. **Cascade Priority** (Free-First):
   ```
   URL: Cache → llms.txt → Jina → Direct Fetch → Firecrawl → Mistral
   Query: Cache → Exa MCP → DuckDuckGo → Exa/Tavily → Serper
   ```

2. **Content Size Management**:
   - Exploration: 4000 chars (~1000 tokens)
   - Standard: 8000 chars (~2000 tokens)
   - Deep research: 12000 chars (~3000 tokens)

3. **Caching Layers**:
   - Request cache (session)
   - Routing memory (30-day TTL)
   - Negative cache (failed requests)
   - LLM response cache (synthesized content)

### Quality Scoring Configuration

**Thresholds by Context**:
| Context | Min Score | Action on Low |
|---------|-----------|---------------|
| api-docs | 0.85 | Reject, retry with quality profile |
| reference | 0.80 | Review, may accept |
| tutorial | 0.75 | Accept with warning |
| general | 0.70 | Quick validation only |

**Penalties**:
- Too short (< MIN_CHARS): -0.35
- Missing links: -0.15
- Duplicate heavy (>30%): -0.25
- Noisy content: -0.20

## Swarm Agent Assignments

### Agent 1: Deep Researcher (Research Gatherer)

**Focus**: Comprehensive web research and documentation analysis
**Strategy**: 
- Use `free` profile for broad coverage
- Batch process with max 5 parallel
- Target 50+ sources per topic
- Prioritize recent, authoritative sources

**Tasks**:
1. Resolve all queries from `research_queries.txt`
2. Score each result (target: >0.75)
3. Extract and catalog key findings
4. Identify knowledge gaps

**Output**: `/analysis/agent1_research.md`

### Agent 2: Quality Validator

**Focus**: Validate all references, links, and citations
**Strategy**:
- Use `quality` profile for critical sources
- Full link validation (all URLs checked)
- Citation extraction and verification
- Cross-reference critical facts

**Tasks**:
1. Validate top 20% of sources (by score)
2. Check all links for 404s, redirects
3. Verify citation completeness
4. Generate validation report

**Output**: `/analysis/agent2_validation.md`

### Agent 3: Token Optimizer

**Focus**: Analyze research efficiency and token optimization
**Strategy**:
- Analyze cache hit rates
- Calculate cost/performance ratios
- Identify optimization opportunities
- Recommend configuration changes

**Tasks**:
1. Calculate metrics from research summary
2. Identify high-cost, low-value queries
3. Suggest cache warming strategies
4. Recommend profile adjustments

**Output**: `/analysis/agent3_optimization.md`

## Execution Plan

### Phase 1: Parallel Investigation (60 min target)
- [ ] Agent 1: Execute batch web research
- [ ] Agent 2: Pre-validate seed sources
- [ ] Agent 3: Baseline metrics capture

### Phase 2: Synthesis (30 min target)
- [ ] Consolidate findings across agents
- [ ] Identify consensus and conflicts
- [ ] Determine root causes
- [ ] Prioritize recommendations

### Phase 3: Resolution (30 min target)
- [ ] Generate optimization guide
- [ ] Update workflow documentation
- [ ] Validate final outputs
- [ ] Create PR with results

## Success Criteria

- [ ] Cache hit rate >60%
- [ ] Average quality score >0.75
- [ ] All critical links validated
- [ ] Token savings documented
- [ ] GitHub Actions pass
- [ ] Synthesis report generated

## Research Output Structure

```
analysis/
├── research_queries.txt        # Query definitions
├── web_research/
│   ├── _summary.json           # Aggregated metrics
│   ├── query_1.json            # Individual results
│   ├── query_2.json
│   └── ...
├── agent1_research.md          # Deep researcher output
├── agent2_validation.md        # Quality validator output
├── agent3_optimization.md      # Token optimizer output
├── SWARM_SYNTHESIS.md          # Consolidated findings
└── swarm_context.md            # This file

reports/
├── web_research_metrics.json   # Performance metrics
├── validation_report.json      # Link validation results
└── optimization_recommendations.md
```

## Web Resolver API Reference

### Configuration Options

```bash
# Environment variables
export WEB_RESOLVER_PROFILE=quality      # free|fast|balanced|quality
export WEB_RESOLVER_MAX_CHARS=8000       # Content limit
export WEB_RESOLVER_MIN_CHARS=200        # Minimum threshold
export WEB_RESOLVER_CACHE_TTL_DAYS=30    # Cache duration

# API Keys (for paid providers)
export EXA_API_KEY=""
export TAVILY_API_KEY=""
export FIRECRAWL_API_KEY=""
export MISTRAL_API_KEY=""
```

### Command Examples

```bash
# Single URL resolution
python -m scripts.resolve "https://docs.example.com" \
  --profile quality \
  --validate-links \
  --trace --json

# Batch query resolution
python -m scripts.resolve queries.txt \
  --profile balanced \
  --max-parallel 3 \
  --output-dir web_research/

# With full validation
python -m scripts.resolve "topic" \
  --profile quality \
  --validation-level strict \
  --check-citations \
  --cross-reference
```

### Quality Score Interpretation

| Score | Meaning | Action |
|-------|---------|--------|
| 0.9+ | Excellent | Use as primary source |
| 0.8-0.9 | Good | Use with confidence |
| 0.7-0.8 | Acceptable | Review before using |
| 0.6-0.7 | Marginal | Verify key facts |
| <0.6 | Poor | Discard or retry |

## Circuit Breaker Configuration

```python
# Automatic failover settings
CIRCUIT_BREAKER_THRESHOLD = 3       # failures before opening
CIRCUIT_BREAKER_COOLDOWN = 300      # seconds before retry
RATE_LIMIT_SLEEP = 2                # seconds between batches
MAX_PARALLEL_FREE = 5               # free providers
MAX_PARALLEL_PAID = 3               # paid providers
```

## References

- `agents-docs/WEB_RESEARCH_OPTIMIZATION.md` - Full optimization guide
- `.agents/skills/do-web-doc-resolver/SKILL.md` - Resolver documentation
- `.agents/skills/agent-coordination/SWARM.md` - Swarm patterns
- `scripts/swarm-worktree-web-research.sh` - Workflow script
