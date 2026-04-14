# Workflow Patterns

## Sequential Workflow

Execute skills in dependency order, where output of one feeds into the next.

### Pattern
```
[Skill A] → [Skill B] → [Skill C]
```

### Example: Create Production-Ready API
```
1. api-design-first     → Design the API specification
2. security-code-auditor → Review spec for security issues
3. skill-creator         → Create documentation skill for the API
```

### Implementation
```python
def sequential_workflow(tasks):
    context = {}
    for task in tasks:
        result = execute_skill(task.skill, task.input, context)
        context[task.output_key] = result
    return context
```

## Parallel Workflow

Execute independent skills simultaneously.

### Pattern
```
         ┌→ [Skill A] →┐
[Input] ─┼→ [Skill B] ─┼→ [Aggregator] → [Output]
         └→ [Skill C] →┘
```

### Example: Comprehensive Code Review
```
1. security-code-auditor  → Security issues
2. shell-script-quality    → Script quality (parallel)
3. skill-creator          → Skill structure review
```

### Implementation
```python
import asyncio

async def parallel_workflow(tasks):
    results = await asyncio.gather(
        *[execute_skill(t.skill, t.input) for t in tasks]
    )
    return aggregate_results(results)
```

## Conditional Workflow

Route to different skills based on classification confidence.

### Pattern
```
[Classifier] → (confidence > 0.7) → [Skill A]
             → (confidence 0.3-0.7) → [Ask User]
             → (confidence < 0.3) → [General Help]
```

### Example
```python
def conditional_workflow(request):
    matches = classify_intent(request)
    top_match = matches[0]
    
    if top_match.confidence > 0.7:
        return execute_skill(top_match.skill, request)
    elif top_match.confidence > 0.3:
        return ask_user_to_confirm(top_match, matches[1:3])
    else:
        return general_assistance(request)
```

## Iterative Workflow

Loop until quality criteria are met.

### Pattern
```
┌─────────────────────────────────────┐
│  [Skill] → [Validate] → [Pass?] ─┬─→ [Output]
│      ↑───────────────────────────┘ (No)
└─────────────────────────────────────┘
```

### Example: Refine API Design
```
1. api-design-first → Generate spec
2. Validate against requirements
3. If issues found → Iterate on design
4. Repeat until spec passes validation
```

### Implementation
```python
def iterative_workflow(skill, input_data, validator, max_iterations=5):
    for i in range(max_iterations):
        result = execute_skill(skill, input_data)
        
        validation = validator.check(result)
        if validation.passed:
            return result
        
        input_data = {
            'previous_attempt': result,
            'feedback': validation.feedback
        }
    
    raise MaxIterationsExceeded()
```

## Swarm Workflow

Multiple specialized agents analyze from different perspectives.

### Pattern
```
              ┌→ [Agent A: Security] →┐
[Input] ──────┼→ [Agent B: Performance]┼→ [Synthesizer] → [Output]
              └→ [Agent C: UX] ───────┘
```

### Example: UI/UX Optimization
```
1. anti-ai-slop agent    → Authenticity review
2. ui-ux-optimize agent  → Usability analysis
3. Accessibility agent    → a11y compliance
4. Synthesizer           → Combined recommendations
```

## Composite Workflow

Multiple skills orchestrated by a parent skill.

### Pattern
```
[Composite Skill]
   ├→ [Sub-skill A]
   ├→ [Sub-skill B]
   └→ [Sub-skill C]
      ↓
   [Integrate Results]
```

### Example: Full Security Audit
```
security-code-auditor (parent)
  ├→ Static analysis
  ├→ Dependency scanning
  ├→ Configuration review
  └→ Secret detection
     ↓
  [Generate Report]
```

## Error Handling Patterns

### Retry with Exponential Backoff
```python
@retry(stop=stop_after_attempt(3), wait=wait_exponential())
def execute_with_retry(skill, input_data):
    return execute_skill(skill, input_data)
```

### Circuit Breaker
```python
if skill_failure_rate > 0.5:
    disable_skill_temporarily(skill)
    use_fallback_skill(fallback)
```

### Fallback Chain
```python
skills = [primary_skill, secondary_skill, general_assistance]
for skill in skills:
    try:
        return execute_skill(skill, request)
    except ExecutionError:
        continue
```

## Best Practices

1. **Define clear handoffs** - Document what each skill expects and produces
2. **Include validation gates** - Check output quality between steps
3. **Support rollback** - Allow reverting to previous states
4. **Monitor performance** - Track execution time and success rates
5. **Log decisions** - Record why certain paths were taken
6. **User transparency** - Inform user when multiple skills are involved
