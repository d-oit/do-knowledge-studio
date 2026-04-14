# Classification Rules

## Intent Extraction Algorithm

### Step 1: Tokenization
- Split request into individual words
- Remove common stop words (the, a, an, etc.)
- Normalize to lowercase
- Preserve technical terms as-is

### Step 2: Keyword Matching
- Extract action verbs (create, update, delete, audit, design, etc.)
- Extract technology terms (docker, kubernetes, api, react, etc.)
- Extract file extensions (.py, .js, .yaml, etc.)
- Extract domain terms (security, database, frontend, etc.)

### Step 3: Context Analysis
- Check for file paths or glob patterns
- Identify code snippets or configuration content
- Detect question vs command intent
- Note urgency indicators (urgent, asap, critical)

## Scoring Algorithm

### Base Score Calculation
```
base_score = (
  exact_match_weight * exact_matches +
  keyword_weight * keyword_matches +
  domain_weight * domain_matches +
  action_weight * action_matches
) / normalization_factor
```

### Weight Values
- Exact match: 1.0 (skill description contains exact phrase)
- Keyword match: 0.5 (skill keywords match)
- Domain match: 0.3 (same technology domain)
- Action match: 0.2 (same action verb)

### Confidence Calculation
```python
def calculate_confidence(matches, total_keywords):
    if total_keywords == 0:
        return 0.0
    
    raw_score = sum(m['weight'] for m in matches)
    max_possible = total_keywords * 1.0  # All exact matches
    
    confidence = raw_score / max_possible
    
    # Boost for multiple match types
    match_types = len(set(m['type'] for m in matches))
    if match_types >= 3:
        confidence *= 1.1
    
    return min(confidence, 1.0)
```

## Match Types

### Exact Match
User request contains phrase from skill description:
- Skill: "Use when users ask to 'create a skill'"
- Request: "I want to create a new skill"
- Result: Exact match on "create a skill"

### Keyword Match
User request contains skill keywords:
- Skill keywords: openapi, swagger, api, rest
- Request: "Design my REST API using OpenAPI"
- Result: Matches openapi, rest, api

### Domain Match
Same technology domain:
- User mentions Docker, Kubernetes, containers
- Skill targets containerization domain

### Action Match
Same action verb:
- User wants to "audit" code
- Skill triggers on "security review", "audit"

## Confidence Thresholds

| Range | Classification | Action |
|-------|----------------|--------|
| 0.85 - 1.0 | Very High | Execute immediately |
| 0.70 - 0.84 | High | Execute with brief confirmation |
| 0.50 - 0.69 | Medium | Ask user to confirm selection |
| 0.30 - 0.49 | Low | Present top 2-3 options |
| 0.00 - 0.29 | None | Use general assistance |

## Handling Ambiguity

### Tie-Breaking Rules
1. More keyword matches wins
2. Exact match beats keyword match
3. More specific skill beats general skill
4. Recently used skill gets slight boost

### Clarification Questions
When confidence is Medium or Low:
- "Did you mean to [skill action] or [alternative]?"
- "Are you working with [technology] or [alternative]?"
- "Do you want to [action A] or [action B]?"

## Multi-Intent Detection

### Sequential Detection
Look for trigger words:
- "first... then..."
- "after that..."
- "and then..."

### Parallel Detection
Look for unrelated tasks:
- "Also, I need to..."
- "While we're at it..."
- "Additionally..."

### Composite Detection
Complex requests with single outcome:
- "Create a secure API" → api-design-first + security review
- "Build a production-ready skill" → skill-creator + best practices

## Special Cases

### Greetings/Chat
- "Hello", "How are you?" → General assistance
- Confidence: 0.0 for all specific skills

### Vague Requests
- "Help me" → General assistance
- "Fix this" → Ask for clarification

### Contradictory Requests
- "Create API but don't write code" → Flag as contradictory
- Ask user to clarify priorities

## Example Classifications

| Request | Primary Skill | Confidence | Reasoning |
|---------|---------------|------------|-----------|
| "Create a skill for AWS" | skill-creator | 0.92 | Exact match "create a skill" |
| "Check my code for vulnerabilities" | security-code-auditor | 0.85 | Domain + action match |
| "Design REST endpoints" | api-design-first | 0.88 | Keyword matches |
| "How do I use git?" | (none) | 0.15 | No skill matches |
