---
name: intent-classifier
description: Classify user intents and route to appropriate skills, commands, or workflows. Use when determining which skill to invoke, routing requests to specialized agents, or building skill selection logic. Trigger on 'which skill should I use', 'route this to', 'classify this request', 'skill selection', or when multiple skills could handle a task.
license: MIT
---

# Intent Classifier

Classify user requests and route them to the most appropriate skill, command, or specialized agent.

## Classification Workflow

### 1. Intent Extraction
- Parse the user's natural language request
- Identify primary action (create, update, delete, analyze, etc.)
- Extract entities (file paths, technologies, specific terms)

### 2. Skill Matching
- Compare against available skills catalog
- Score match confidence for each candidate
- Consider skill descriptions and keywords

### 3. Route Decision
- Select highest-confidence match
- Handle ties and ambiguous cases
- Fall back to general assistance if no match

## Classification Rules

### Priority Order
1. **Exact keyword match** - Skill description contains exact phrase
2. **Domain match** - Technology stack alignment
3. **Action match** - Verb/action alignment
4. **Context match** - File paths, extensions, surrounding context

### Confidence Scoring
```
High (0.8-1.0):   Exact description match, multiple keyword hits
Medium (0.5-0.7): Partial match, related domain
Low (0.3-0.4):    Weak match, shared keywords only
None (<0.3):      No relevant match
```

## Multi-Intent Handling

When a request contains multiple intents:
1. **Sequential** - Chain skills in dependency order
2. **Parallel** - Execute independent skills simultaneously
3. **Composite** - Use parent skill that orchestrates sub-skills

## Fallback Strategies

| Confidence | Action |
|------------|--------|
| > 0.7 | Execute primary skill |
| 0.5 - 0.7 | Execute skill with confirmation |
| 0.3 - 0.5 | Present top 2-3 options to user |
| < 0.3 | Use general assistance |

## Dynamic Catalog

Update the skill catalog using:
```bash
./scripts/dynamic-catalog.sh
```

This scans `.agents/skills/` and regenerates the skill registry with:
- Skill names and descriptions
- Keywords extracted from descriptions
- Compatibility requirements

## Skill Selection Examples

| User Request | Primary Intent | Routed Skill |
|--------------|----------------|--------------|
| "Create a new skill for Docker" | Skill creation | skill-creator |
| "Audit my code for security issues" | Security audit | security-code-auditor |
| "Design a REST API for users" | API design | api-design-first |
| "Fix this bug in my Python script" | Code debugging | (general) |

## References

- `references/classification-rules.md` - Detailed classification algorithm
- `references/skill-catalog.md` - Auto-generated skill registry
- `references/workflow-patterns.md` - Multi-skill orchestration patterns
