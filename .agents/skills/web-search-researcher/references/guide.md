# Web Search Research - Reference Guide

Comprehensive guide for systematic web research with strategic searches, content analysis, and synthesized findings.

## Date Context Awareness

**CRITICAL**: Always check your environment context (`<env>`) for the current date before starting research.

**Why this matters**:
- Ensures searches use current year for recent information
- Helps evaluate source freshness and relevance
- Prevents relying on outdated best practices
- Improves search result quality

**How to use**:
1. Check `<env>` tag for "Today's date: YYYY-MM-DD"
2. Extract current year (e.g., 2025)
3. Include current year in searches for best practices, frameworks, or evolving technologies
4. Use current date to evaluate publication freshness (within 12-18 months = recent)

## Core Responsibilities - Deep Dive

### 1. Analyze the Query

Break down the user's request to identify:
- Key search terms and concepts
- Types of sources likely to have answers (documentation, blogs, forums, academic papers)
- Multiple search angles to ensure comprehensive coverage

**Query Analysis Template**:
```markdown
## Query Analysis

**User Request**: [Original question]

**Key Concepts**:
- [Concept 1]
- [Concept 2]
- [Concept 3]

**Source Types to Target**:
- [ ] Official documentation
- [ ] Technical blogs
- [ ] Q&A sites (Stack Overflow)
- [ ] GitHub issues/discussions
- [ ] Academic papers
- [ ] Conference talks

**Search Angles**:
1. [Broad overview search]
2. [Specific technical search]
3. [Site-specific search]
4. [Comparison search]
```

### 2. Execute Strategic Searches

- Start with broad searches to understand the landscape
- Refine with specific technical terms and phrases
- Use multiple search variations to capture different perspectives
- Include site-specific searches when targeting known authoritative sources

**Search Strategy Examples**:

For API documentation:
```
"[library name] official documentation [specific feature]"
site:docs.stripe.com webhook signature
```

For best practices:
```
"Rust async best practices" 2026
"Tokio performance anti-patterns" 2026
```

For technical solutions:
```
"tokio runtime panic" redb write transaction
site:github.com tokio blocking write transaction
```

For comparisons:
```
"redb vs sled" performance comparison
"SQLite vs Turso" migration guide
```

### 3. Fetch and Analyze Content

- Use WebFetch to retrieve full content from promising search results
- Prioritize official documentation, reputable technical blogs, and authoritative sources
- Extract specific quotes and sections relevant to the query
- Note publication dates to ensure currency of information

**Content Analysis Checklist**:
- [ ] Source is authoritative (official docs, recognized expert)
- [ ] Content is current (within 12-18 months for fast-moving tech)
- [ ] Information is relevant to specific query
- [ ] Claims are backed by evidence or examples
- [ ] No obvious bias or commercial agenda

### 4. Synthesize Findings

- Organize information by relevance and authority
- Include exact quotes with proper attribution
- Provide direct links to sources
- Highlight any conflicting information or version-specific details
- Note any gaps in available information

**Synthesis Template**:
```markdown
## Summary
[2-3 sentence overview of key findings]

## Detailed Findings

### [Topic/Source 1]
**Source**: [Name with link]
**Relevance**: [Why this source is authoritative/useful]
**Key Information**:
- Direct quote or finding (with link to specific section)
- Another relevant point

### [Topic/Source 2]
**Source**: [Name with link]
**Relevance**: [Why this source is authoritative/useful]
**Key Information**:
- Finding 1
- Finding 2

## Additional Resources
- [Relevant link 1] - Brief description
- [Relevant link 2] - Brief description

## Gaps or Limitations
[Note any information that couldn't be found or requires further investigation]
```

## Search Strategies - Comprehensive Guide

### For API/Library Documentation

**Approach**:
1. Search for official docs first
2. Look for changelog or release notes
3. Find code examples in official repositories

**Example Searches**:
```
"Stripe webhook signature verification" official documentation
site:stripe.com webhook signature validation
"Stripe webhook" signature example code
```

**Expected Sources**:
- Official API documentation
- GitHub repository examples
- Official blog posts
- Verified integration guides

### For Best Practices

**Approach**:
1. Search for recent articles (always include current year from environment)
2. Look for content from recognized experts or organizations
3. Cross-reference multiple sources to identify consensus
4. Search for both "best practices" and "anti-patterns"

**Example Searches**:
```
"Rust async best practices" 2026
"Tokio performance anti-patterns" 2026
site:blog.rust-lang.org async errors
"anyhow vs thiserror" async context
```

**Expected Sources**:
- Official blog posts
- Expert technical blogs
- Conference presentations
- Well-voted Stack Overflow answers

### For Technical Solutions

**Approach**:
1. Use specific error messages or technical terms in quotes
2. Search Stack Overflow and technical forums
3. Look for GitHub issues and discussions
4. Find blog posts describing similar implementations

**Example Searches**:
```
"tokio runtime panic" redb write transaction
site:github.com tokio spawn_blocking database
"redb" async tokio integration
"database write blocking async runtime"
```

**Expected Sources**:
- GitHub issues with maintainer responses
- Stack Overflow accepted answers
- Technical blog troubleshooting posts
- Forum discussions with solutions

### For Comparisons

**Approach**:
1. Search for "X vs Y" comparisons
2. Look for migration guides between technologies
3. Find benchmarks and performance comparisons
4. Search for decision matrices or evaluation criteria

**Example Searches**:
```
"redb vs sled" performance comparison
"SQLite vs Turso" migration guide
"embedded database comparison" Rust
"redb sled sqlite" benchmarks
```

**Expected Sources**:
- Benchmark comparisons
- Migration guides
- Decision framework articles
- Community discussions with trade-off analysis

## Search Efficiency - Progressive Strategy

### Round 1: Oriented Search (5 minutes)

**Goal**: Understand the landscape

**Actions**:
- Run 1-2 broad searches
- Quickly scan result titles and snippets
- Identify: Is this well-documented? Common? Novel?

**Decision Point**:
- If official docs found → Fetch and possibly stop
- Otherwise → Continue to Round 2

**Example**:
```
Search: "Rust async best practices"
Results: Scan for official Rust blog, well-known experts
Decision: Found official async book → Fetch, may stop
```

### Round 2: Targeted Search (10 minutes)

**Goal**: Find authoritative sources

**Actions**:
- Run 2-3 specific searches with refined terms
- Use site-specific searches for known authorities
- Fetch 2-3 most promising sources

**Decision Point**:
- If sufficient consensus → Synthesize and stop
- Otherwise → Continue to Round 3

**Example**:
```
Search 1: site:docs.rust-lang.org async
Search 2: "tokio" best practices 2026
Search 3: site:blog.rust-lang.org async patterns
Decision: Found 3 sources with consensus → Synthesize
```

### Round 3: Deep Dive (15 minutes)

**Goal**: Fill gaps and resolve conflicts

**Actions**:
- Search for specific missing information
- Look for alternative perspectives
- Find production examples or case studies
- Fetch 2-4 additional sources

**Decision Point**:
- Synthesize findings regardless of gaps
- Note limitations clearly

**Example**:
```
Search 1: "tokio blocking" production case study
Search 2: async database write patterns GitHub
Search 3: redb async integration issues
Decision: Have enough for synthesis with noted gaps
```

### Round 4: Extended Research (optional, 20+ minutes)

**Goal**: Only for critical decisions or persistent gaps

**Actions**:
- Search academic sources, security advisories
- Look for expert interviews or conference presentations
- Find comparative analyses

**Requirement**: Must justify why Rounds 1-3 were insufficient

**Example Use Cases**:
- Architecture decisions with long-term impact
- Security-sensitive choices
- Novel problem domains with limited information

**Efficiency Tip**: Most research should complete in Round 2. Only 20% of tasks justify Round 3, and <5% justify Round 4.

## Quick Result Evaluation

Before fetching content, rapidly triage search results using this priority matrix:

### Priority 1 (Fetch First) ⭐⭐⭐

**Sources**:
- Official documentation from library/framework maintainers
- GitHub issues/PRs from project maintainers
- Production case studies from reputable companies
- Recent posts (within current year or last 12 months) from recognized experts

**Indicators**:
- URLs contain official domains (docs.*, rust-lang.org, github.com/official)
- Author is maintainer/core contributor
- Recent date visible in snippet

**Action**: Fetch immediately

### Priority 2 (Fetch If Needed) ⭐⭐

**Sources**:
- Technical blog posts from known experts
- Stack Overflow answers with high votes (>50) and recent activity
- Conference talks/presentations from domain experts
- Tutorial sites with technical depth

**Indicators**:
- Author credentials visible
- Multiple upvotes/endorsements
- Specific technical details in snippet

**Action**: Fetch if Priority 1 insufficient

### Priority 3 (Skip Unless Desperate) ⭐

**Sources**:
- Generic tutorials without author credentials
- Old posts (>3 years) without recent updates
- Forum discussions without resolution
- Marketing/promotional content

**Indicators**:
- No author info
- Old dates
- Vague descriptions
- Commercial bias

**Action**: Skip unless no other sources

### Red Flags (Never Fetch) 🚫

**Sources**:
- AI-generated content farms
- Duplicate content aggregators
- Paywalled content without abstracts
- Sources contradicting official docs without justification

**Indicators**:
- Generic domain (content farm patterns)
- Multiple similar articles with spun content
- No clear authorship
- Clickbait titles

**Action**: Never fetch, find alternative

**Triage Time Budget**: Spend 30-60 seconds per search result page reviewing titles, URLs, snippets, and dates before fetching.

## Search Operators - Complete Reference

### Basic Operators

| Operator | Purpose | Example |
|----------|---------|---------|
| `"exact phrase"` | Exact match | `"async runtime"` |
| `-term` | Exclude term | `rust -game` |
| `OR` | Alternative | `tokio OR async-std` |
| `*` | Wildcard | `async * pattern` |

### Advanced Operators

| Operator | Purpose | Example |
|----------|---------|---------|
| `site:` | Specific domain | `site:docs.rust-lang.org` |
| `filetype:` | File type | `filetype:pdf` |
| `intitle:` | In title | `intitle:best practices` |
| `inurl:` | In URL | `inurl:documentation` |
| `related:` | Similar sites | `related:stripe.com` |
| `before:YYYY` | Before date | `async before:2023` |
| `after:YYYY` | After date | `async after:2024` |

### Combined Examples

```
"webhook signature" site:stripe.com after:2024
"best practices" -tutorial site:github.com
intitle:"async" OR intitle:"concurrent" rust
```

## Research Depth Levels - Detailed Guide

### Quick Research (15-20 minutes)

**Use for**: Simple questions, checking current syntax, verifying basic facts

**Process**:
1. 1-2 targeted searches
2. Fetch 1-2 most authoritative sources (official docs preferred)
3. Extract specific answer
4. Skip deep synthesis

**Example Query**: "What's the signature for Stripe webhook verification?"

**Expected Output**:
```markdown
## Summary
Stripe provides `Stripe.Webhook.construct_event()` for signature verification.

## Source
**Stripe Documentation**: [Webhook signatures](https://stripe.com/docs/webhooks/signatures)

**Key Information**:
```python
event = stripe.Webhook.construct_event(
    payload, sig_header, endpoint_secret
)
```
```

### Standard Research (30-45 minutes)

**Use for**: Technical decisions, best practices, understanding approaches

**Process**:
1. 2-3 strategic searches (broad + specific)
2. Fetch 3-5 high-quality sources
3. Cross-reference for consensus
4. Structured synthesis with template

**Example Query**: "Best practices for redb + Tokio integration"

**Expected Output**:
```markdown
## Summary
Use tokio::task::spawn_blocking for redb write operations to avoid blocking async runtime.

## Detailed Findings

### Official Guidance
**Source**: [Tokio Documentation](https://tokio.rs)
**Key Information**:
- Use spawn_blocking for CPU-bound or blocking operations
- Prevents blocking the async runtime

### redb Specific
**Source**: [redb GitHub](https://github.com/redb)
**Key Information**:
- Write transactions are blocking
- Wrap in spawn_blocking

## Additional Resources
- [Tokio spawn_blocking docs](link)
- [redb examples](link)
```

### Deep Research (60-90 minutes)

**Use for**: Architecture decisions, comparing multiple solutions, critical systems

**Process**:
1. 4-6 multi-angle searches
2. Fetch 6-10 sources (mix of official docs, case studies, expert opinions)
3. Compare trade-offs and alternatives
4. Comprehensive synthesis with decision matrix
5. Follow-up searches to fill gaps

**Example Query**: "Should we use redb vs sled vs SQLite for our memory system?"

**Expected Output**:
```markdown
## Summary
For embedded Rust memory systems, redb offers best type safety, sled has most features, SQLite has broadest ecosystem.

## Comparison Matrix

| Criteria | redb | sled | SQLite |
|----------|------|------|--------|
| Type Safety | High | Medium | Low |
| Performance | High | High | Medium |
| Ecosystem | Small | Medium | Large |
| Embedded | Excellent | Good | Good |

## Recommendation
Use redb for new Rust projects prioritizing type safety.
```

### Exhaustive Research (2+ hours)

**Use for**: Mission-critical decisions, novel problem domains, security-sensitive choices

**Process**:
1. Multiple search sessions over time
2. 10+ authoritative sources
3. Include academic papers, security advisories, production incident reports
4. Build comprehensive knowledge base
5. Validate with experts if possible

**Example Query**: "Design distributed consensus system for multi-region deployment"

**Rule**: Set a timer. When time expires, synthesize what you have and note gaps rather than continuing indefinitely.

## Research Workflow - Step by Step

### Step 0: Determine Research Depth

Before starting, decide which depth level (Quick/Standard/Deep/Exhaustive) is appropriate based on:
- Task criticality
- Decision impact
- Time constraints
- Information availability

**Depth Decision Matrix**:
```
Task Impact: Low → Quick Research
Task Impact: Medium → Standard Research
Task Impact: High → Deep Research
Task Impact: Critical → Exhaustive Research

Time Available: <30min → Quick/Standard
Time Available: 1-2hr → Standard/Deep
Time Available: 2+hr → Deep/Exhaustive
```

### Step 1: Plan Searches

```markdown
Query: [User's question]

Key Concepts:
- [Concept 1]
- [Concept 2]
- [Concept 3]

Search Variations:
1. [Broad search] - Understand landscape
2. [Specific technical search] - Find technical details
3. [Site-specific search] - Target authoritative sources
```

### Step 2: Execute Searches

- Run 2-3 initial searches
- Review search results for promising sources
- Identify authoritative and relevant URLs
- Apply triage (Priority 1/2/3/Red Flag)

### Step 3: Fetch Content

- Use WebFetch on 3-5 most promising URLs
- Extract relevant information
- Note publication dates and context
- Save source metadata (URL, title, date, author)

### Step 4: Synthesize

- Organize findings by theme/topic
- Identify consensus and conflicts
- Structure using output format template
- Note any gaps or limitations

### Step 4.5: Evaluate Stopping Criteria

Recognize these signals that you have sufficient information:

#### Positive Indicators (Stop Here) ✅

1. **Consensus Found**: 3+ authoritative sources agree on the approach
2. **Official Guidance Located**: Found maintainer recommendations or official docs
3. **Production Validation**: Found real-world implementations with similar constraints
4. **Actionable Path**: Have clear next steps and implementation guidance
5. **Trade-offs Understood**: Understand pros/cons of main approaches
6. **Time Limit Reached**: Hit your time-box limit with adequate information

#### Warning Signs (Keep Searching) ⚠️

1. **Conflicting Information**: Sources strongly disagree without version/context explanation
2. **Outdated Only**: All sources are >2 years old for fast-moving tech
3. **No Official Source**: Haven't found maintainer or official documentation
4. **Unclear Actionability**: Can't determine specific next steps
5. **Missing Context**: Don't understand why recommendations exist

#### Diminishing Returns (Stop Soon) 📉

- New sources repeat information already found
- Spending >10 minutes without finding new insights
- Found 8+ sources that all say roughly the same thing
- Searches returning increasingly tangential results

**Decision Rule**: If you've reached time-box limit AND have positive indicators, stop. If critical gaps remain, extend time-box by 50% maximum, then stop regardless.

### Step 5: Report

- Present findings clearly using output format
- Provide actionable insights
- Note any limitations or gaps
- Include all source links

## Output Format - Complete Template

```markdown
## Summary
[Brief overview of key findings - 2-3 sentences]

## Detailed Findings

### [Topic/Source 1]
**Source**: [Name with link]
**Relevance**: [Why this source is authoritative/useful]
**Key Information**:
- Direct quote or finding (with link to specific section if possible)
- Another relevant point

### [Topic/Source 2]
**Source**: [Name with link]
**Relevance**: [Why this source is authoritative/useful]
**Key Information**:
- Finding 1
- Finding 2

## Additional Resources
- [Relevant link 1] - Brief description
- [Relevant link 2] - Brief description

## Gaps or Limitations
[Note any information that couldn't be found or requires further investigation]
```

## Quality Guidelines - Detailed

### Accuracy

**Requirements**:
- Always quote sources accurately and provide direct links
- Include specific section links when possible
- Preserve technical terminology exactly as written
- Verify quotes in context before including

**Verification Checklist**:
- [ ] Quotes match source exactly
- [ ] Links go to specific sections (not just homepages)
- [ ] Technical terms preserved accurately
- [ ] Numbers and statistics verified

### Relevance

**Requirements**:
- Focus on information that directly addresses the user's query
- Filter out tangential or outdated information
- Prioritize actionable insights

**Relevance Test**:
- Does this finding directly answer the user's question?
- Would removing this change the answer?
- Is this actionable for the user's situation?

### Currency

**Requirements**:
- Always check environment context (`<env>`) for current date before evaluating freshness
- Note publication dates and version information when relevant
- For fast-moving tech: prioritize sources from current year
- For stable tech: sources 2-3 years old may still be valid
- Indicate if information may be outdated relative to current date
- Look for recent updates or newer alternatives

**Freshness Guidelines**:
| Tech Type | Acceptable Age | Priority |
|-----------|----------------|----------|
| Fast-moving (AI, frameworks) | <12 months | Current year only |
| Established (Rust, Python) | <24 months | Prefer recent |
| Stable (databases, protocols) | <36 months | Still valid |

### Authority

**Requirements**:
- Prioritize official sources, recognized experts, and peer-reviewed content
- Note the credibility of each source
- Be skeptical of unverified claims

**Authority Indicators**:
- Official domain (docs.*, project website)
- Known expert author (GitHub contributions, conference talks)
- High engagement (stars, forks, citations)
- Peer review (academic papers, RFCs)

### Completeness

**Requirements**:
- Search from multiple angles to ensure comprehensive coverage
- Don't stop at the first result - validate with multiple sources
- Identify consensus vs. outlier opinions

**Completeness Checklist**:
- [ ] Searched official documentation
- [ ] Searched expert blogs/tutorials
- [ ] Searched community discussions
- [ ] Found multiple sources agreeing
- [ ] Noted any conflicting information

### Transparency

**Requirements**:
- Clearly indicate when information is outdated, conflicting, or uncertain
- Acknowledge gaps in available information
- Distinguish between official guidance and community opinions

**Transparency Markers**:
- "According to official documentation..."
- "Community consensus suggests..."
- "Note: This information is from 2022 and may be outdated"
- "No authoritative source found for..."

## Examples - Complete Walkthroughs

### Example 1: API Documentation Research

**Query**: "How do I verify webhook signatures in Stripe?"

**Search Strategy**:
1. `"Stripe webhook signature verification" official documentation`
2. `site:stripe.com webhook endpoints security`
3. `"Stripe webhook" signature example code`

**Expected Output**:
```markdown
## Summary
Stripe provides a library method `Stripe.Webhook.construct_event()` to verify webhook signatures using the endpoint secret.

## Detailed Findings

### Official Stripe Documentation
**Source**: [Stripe Webhook Signatures](https://stripe.com/docs/webhooks/signatures)
**Relevance**: Official documentation from Stripe
**Key Information**:
```python
import stripe

event = stripe.Webhook.construct_event(
    payload, sig_header, endpoint_secret
)
```

### Implementation Example
**Source**: [Stripe GitHub Examples](https://github.com/stripe/stripe-python)
**Key Information**:
- Payload must be raw request body
- Signature from `Stripe-Signature` header
- Handle `SignatureVerificationError`

## Additional Resources
- [Stripe CLI for testing](https://stripe.com/docs/stripe-cli)
- [Webhook security best practices](https://stripe.com/docs/webhooks/best-practices)

## Gaps or Limitations
None - comprehensive official documentation available.
```

### Example 2: Best Practices Research

**Query**: "What are the best practices for async Rust error handling?"

**Pre-search**: Check environment context - current year is 2026

**Search Strategy**:
1. `"Rust async error handling" best practices 2026`
2. `"Tokio error handling" patterns 2026`
3. `site:blog.rust-lang.org async errors`
4. `"anyhow vs thiserror" async context`

**Expected Output**:
```markdown
## Summary
Async Rust error handling uses `anyhow` for applications and `thiserror` for libraries, with proper `.await` error propagation.

## Detailed Findings

### Official Rust Async Book
**Source**: [Rust Async Book](https://rust-lang.github.io/async-book/)
**Relevance**: Official Rust Foundation guidance
**Key Information**:
- Use `Result<T, E>` with async functions
- `.await` propagates errors naturally
- Box errors for trait objects when needed

### Expert Guidance
**Source**: [Rust Blog - Error Handling](https://blog.rust-lang.org)
**Relevance**: Rust core team insights
**Key Information**:
- `anyhow::Result` for applications
- `thiserror` for libraries
- Avoid `unwrap()` in async code

## Additional Resources
- [anyhow crate docs](https://docs.rs/anyhow)
- [thiserror crate docs](https://docs.rs/thiserror)

## Gaps or Limitations
Specific patterns for 2026 edition may have evolved - check latest Rust release notes.
```

### Example 3: Technical Problem Solving

**Query**: "Why is my Tokio runtime blocking on redb writes?"

**Search Strategy**:
1. `"tokio blocking" redb write transaction`
2. `site:github.com tokio spawn_blocking database`
3. `"redb" async tokio integration`
4. `"database write blocking async runtime"`

**Expected Output**:
```markdown
## Summary
redb write transactions are blocking operations that must be wrapped in `tokio::task::spawn_blocking` to avoid blocking the async runtime.

## Detailed Findings

### Tokio Documentation
**Source**: [Tokio spawn_blocking](https://tokio.rs/tokio/tutorial/spawn_blocking)
**Relevance**: Official Tokio guidance on blocking operations
**Key Information**:
- Blocking operations in async context cause runtime starvation
- Use `spawn_blocking` for CPU-bound or blocking I/O
- Returns `JoinHandle` for awaiting result

### redb GitHub Issues
**Source**: [redb Issue #123](https://github.com/redb)
**Relevance**: Maintainer guidance on async integration
**Key Information**:
```rust
let handle = tokio::task::spawn_blocking(move || {
    let txn = db.begin_write().unwrap();
    // ... write operations
});
handle.await.unwrap();
```

### Community Discussion
**Source**: [Rust Users Forum](https://users.rust-lang.org)
**Relevance**: Real-world implementation patterns
**Key Information**:
- Common pattern: wrap write transactions
- Read transactions may also block briefly
- Consider connection pooling for high concurrency

## Additional Resources
- [Tokio async tutorial](https://tokio.rs/tokio/tutorial)
- [redb examples](https://github.com/redb)

## Gaps or Limitations
Performance characteristics may vary - benchmark for your specific workload.
```

## Troubleshooting

### If Search Returns Poor Results

**Symptoms**: Few results, irrelevant content

**Solutions**:
1. Refine search terms (more specific or more general)
2. Try different keyword combinations
3. Use site-specific searches
4. Search for related concepts

**Example**:
```
Poor: "rust database"
Better: "redb embedded database Rust"
Better: "Rust ACID database library"
```

### If Sources Are Outdated

**Symptoms**: All sources >2 years old

**Solutions**:
1. Check environment context for current year
2. Add current year to search query
3. Look for "latest" or "newest" modifiers
4. Check official changelog or release notes
5. Search GitHub for recent issues/discussions

**Example**:
```
Outdated: "Rust async patterns"
Updated: "Rust async patterns 2026"
Updated: "Rust async patterns latest"
```

### If Information Conflicts

**Symptoms**: Sources disagree

**Solutions**:
1. Identify version differences
2. Check publication dates
3. Consider source authority
4. Note all perspectives in findings

**Example**:
```markdown
## Conflicting Information

**Source A (2024)**: Recommends approach X
**Source B (2026)**: Recommends approach Y

**Analysis**: Approach Y is newer, accounts for changes in Rust 1.75
**Recommendation**: Follow Source B (more recent, official)
```

### If No Information Found

**Symptoms**: Empty or near-empty results

**Solutions**:
1. Broaden search scope
2. Try alternative terminology
3. Search adjacent topics
4. Clearly report the gap in findings

**Example**:
```markdown
## Gaps or Limitations

No authoritative information found on [specific topic].
This appears to be a novel problem or emerging pattern.
Recommendation: Consult project maintainers or experiment empirically.
```

## Integration with Other Skills

- **episode-start**: Use web research to gather context before starting episodes
- **feature-implement**: Research API documentation and best practices before implementation
- **debug-troubleshoot**: Search for similar error patterns and solutions
- **architecture-validation**: Research architectural patterns and trade-offs
- **do-web-doc-resolver**: Use for fetching specific URLs identified during research

## Best Practices Summary

### DO:
✓ Check environment context for current date before starting
✓ Use current year in searches for best practices and evolving tech
✓ Use specific, technical search terms
✓ Include version numbers when relevant
✓ Search official documentation first
✓ Cross-reference multiple sources
✓ Note publication dates relative to current date
✓ Provide direct links
✓ Quote sources accurately
✓ Indicate source authority

### DON'T:
✗ Stop at the first search result
✗ Trust unverified sources
✗ Ignore publication dates
✗ Mix up different versions
✗ Omit source attribution
✗ Make assumptions without verification
✗ Overlook conflicting information

## Metrics and Measurement

### Research Quality Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Source authority | 80%+ official/expert | Count official sources |
| Information currency | <12 months for fast-tech | Check publication dates |
| Consensus identification | 3+ agreeing sources | Count agreeing sources |
| Gap transparency | All gaps noted | Review gaps section |
| Actionability | Clear next steps | User feedback |

### Efficiency Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Time to first source | <5 minutes | Track search start to first fetch |
| Total research time | Within time-box | Track start to synthesis |
| Sources fetched | 3-10 quality sources | Count fetched URLs |
| Synthesis completeness | All sections filled | Review output template |
