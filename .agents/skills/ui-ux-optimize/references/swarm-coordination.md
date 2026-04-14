# Swarm Coordination Reference

## Architecture

The ui-ux-optimize skill uses a **swarm of 7 specialized agents** coordinated through handoff contracts. This mirrors the pi-autoresearch pattern: domain-agnostic orchestration infrastructure + domain-specific agent knowledge.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        COORDINATOR (orchestrator)                    │
│  manages loop · tracks confidence · gates quality · logs sessions   │
└──────┬──────────┬──────────┬──────────┬──────────┬──────────┬───────┘
       │          │          │          │          │          │
       ▼          ▼          ▼          ▼          ▼          ▼
  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
  │ RESEARCH│→│ TOKEN   │→│ LAYOUT  │→│ VARIANT │→│ BROWSER │→│ QUALITY │
  │  SCOUT  │ │ARCHITECT│ │ENGINEER │ │GENERATOR│ │VERIFIER │ │ AUDITOR │
  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘
       │                                                              │
       └──────────── ANTI-SLOP SENTINEL (cross-cutting) ──────────────┘
```

## Agent Definitions

### Research Scout
**Phase:** 1 — Research & Translate | **Tools:** `websearch`, `webfetch`
**Output:** `research_context`

```yaml
agent: research_scout
output_contract:
  research_context:
    domain: string
    search_queries: list[{query, results_summary}]
    domain_trends: list[string]
    platform_guidelines: list[string]
    anti_patterns_detected: list[string]
    precedent_products: list[{name, pattern, url}]
    token_influence: list[string]
    navigation_influence: list[string]
confidence_factors:
  - "Number of authoritative sources found"
  - "Recency of sources (< 12 months = high)"
  - "Consensus across sources"
handoff_to: token_architect
```

### Token Architect
**Phase:** 2 — Token & Structure | **Output:** `design_tokens`

```yaml
agent: token_architect
input: [research_context, anti_slop_warnings]
output_contract:
  design_tokens:
    spacing: object
    typography: object
    colors: object
    radius: object
    elevation: object
    motion: object
    border: object
    hud: object  # if game
handoff_to: layout_engineer
```

### Layout Engineer
**Phase:** 2–3 | **Output:** `navigation_model`, `screen_map`, `responsive_spec`

```yaml
agent: layout_engineer
input: [design_tokens, research_context]
output_contract:
  navigation_model: {type, items, height, active_state}
  screen_or_state_map: list[{name, purpose, primary_action, states}]
  responsive_behavior: object[breakpoint → behavior]
  game_ui_spec: object  # if game
  layout_risk_flags: list[string]
handoff_to: variant_generator
```

### Variant Generator
**Phase:** 3 | **Output:** `variant_plan`

```yaml
agent: variant_generator
input: [design_tokens, navigation_model]
output_contract:
  variant_plan:
    base_variant: string
    variants: list[{name, rationale, composition, token_overrides, summary}]
handoff_to: browser_verifier
```

### Browser Verifier
**Phase:** 3 | **Tools:** `bash` (Playwright) | **Output:** `browser_verification`

```yaml
agent: browser_verifier
input: [html_prototype]
output_contract:
  browser_verification:
    screenshots: list[string]
    overlap_issues: list[{viewport, pair, severity}]
    nav_wrap_failures: object
    tap_target_failures: list[{viewport, element, w, h}]
    overall: "PASS | FAIL"
handoff_to: quality_auditor
```

### Quality Auditor
**Phase:** 4 | **Output:** `quality_score`, `lessons_learned`

```yaml
agent: quality_auditor
input: [all_agent_outputs]
output_contract:
  quality_score:
    score: number          # actual score
    max_applicable: number # 57 (non-game) or 66 (game)
    effective_pct: number  # score/max_applicable * 100
    sections: object[section → {score, max}]
    confidence: number     # MAD-based
    decision: "KEEP | REVISE | REVERT"
  lessons_learned: {run_id, what_improved, what_caused_confusion, improvement_rules}
handoff_to: coordinator (loop decision)
```

### Anti-Slop Sentinel
**Phase:** Cross-cutting | **Output:** `anti_slop_warnings`

```yaml
agent: anti_slop_sentinel
output_contract:
  anti_slop_warnings:
    translations: list[{original, translated_to, token_ref}]
    banned_phrases_removed: list[string]
    cliche_substitutions: list[{original, replacement}]
    audit_result: "PASS | FAIL"
```

## Handoff Protocol

### Rules
1. **Sequential by default** — agents run in phase order
2. **Parallel when independent** — Research Scout + Anti-Slop Step 1
3. **Full context always** — downstream agents receive ALL upstream payloads
4. **Flags propagate** — issues stay visible to all downstream agents
5. **No silent fixes** — agents flag problems, don't silently patch

### Revision (Autoresearch Loop)
1. Identify weak section → map to agent
2. Re-run from that agent downstream
3. Try new approach (not repeat same)
4. Re-score, append to session log
5. Max 5 iterations

### Revert
1. Discard current iteration
2. Keep previous best
3. Try different agent strategy
4. Cap at 5 iterations

## Cross-Skill Integration

| Skill | Role |
|---|---|
| `web-search-researcher` | Deep research for Research Scout |
| `anti-ai-slop` | Pattern database for Anti-Slop Sentinel |
| `agent-coordination` | Orchestration patterns |
| `iterative-refinement` | Autoresearch loop patterns |
| `parallel-execution` | Parallel variant generation |
| `task-decomposition` | Multi-screen decomposition |
