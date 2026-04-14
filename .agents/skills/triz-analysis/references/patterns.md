# Software Contradiction Patterns

Common contradictions in software engineering and their TRIZ resolutions.

## Architecture Contradictions

### Monolith vs Microservices
```
Improving: Scalability, team independence
Worsening: Operational complexity, network overhead
Resolution: #1 Segmentation (gradual) + #17 Transition to new dimension (service mesh)
```

### Coupling vs Cohesion
```
Improving: Reusability (loose coupling)
Worsening: Performance (more indirection)
Resolution: #5 Merging (combine hot paths) + #13 Inversion (dependency injection)
```

### Consistency vs Availability
```
Improving: Data consistency (strong)
Worsening: System availability (partition tolerance)
Resolution: #15 Dynamics (eventual consistency) + #20 Continuity (conflict resolution)
```

## Performance Contradictions

### Speed vs Memory
```
Improving: Computation speed (caching)
Worsening: Memory consumption
Resolution: #1 Segmentation (tiered cache) + #27 Cheap short-living (LRU eviction)
```

### Latency vs Throughput
```
Improving: Response latency (individual requests)
Worsening: System throughput (context switching)
Resolution: #19 Periodic action (batching) + #16 Partial action (prioritization)
```

### Real-time vs Accuracy
```
Improving: Real-time responsiveness
Worsening: Result accuracy
Resolution: #16 Partial action (approximate first) + #23 Feedback (refine later)
```

## Security Contradictions

### Security vs Usability
```
Improving: Authentication strength
Worsening: User experience friction
Resolution: #12 Inversion (risk-based auth) + #3 Local quality (adaptive security)
```

### Encryption vs Performance
```
Improving: Data security (encryption)
Worsening: Processing performance
Resolution: #1 Segmentation (encrypt only sensitive) + #15 Dynamics (context-aware)
```

### Audit vs Privacy
```
Improving: Audit trail completeness
Worsening: User privacy
Resolution: #27 Cheap short-living (ephemeral logs) + #31 Porous materials (aggregated metrics)
```

## Maintainability Contradictions

### Flexibility vs Simplicity
```
Improving: System flexibility (configuration options)
Worsening: Code simplicity
Resolution: #6 Universality (sensible defaults) + #7 Nesting (hierarchical config)
```

### Documentation vs Development Speed
```
Improving: Documentation completeness
Worsening: Development velocity
Resolution: #25 Self-service (self-documenting code) + #23 Feedback (auto-generated docs)
```

### Testing vs Time-to-Market
```
Improving: Test coverage
Worsening: Release speed
Resolution: #19 Periodic action (continuous testing) + #25 Self-service (self-testing code)
```

## Agent Instruction Contradictions

### Completeness vs Context Efficiency
```
Improving: Instruction completeness
Worsening: Token limit consumption
Resolution: #4 Asymmetry (heavy in references/, light in skill) + #15 Dynamics (lazy loading)
```

### Autonomy vs Consistency
```
Improving: Agent creative problem-solving
Worsening: Behavioral consistency
Resolution: #12 Equipotentiality (quality gates) + #22 Blessing in disguise (validate output not process)
```

### Reusability vs Specificity
```
Improving: Cross-task reusability
Worsening: Task-specific accuracy
Resolution: #1 Segmentation + #35 Parameter changes (templated skills)
```

### Parallelization vs Correctness
```
Improving: Execution throughput
Worsening: Dependency correctness
Resolution: #25 Self-service (agents detect dependencies) + #13 Inversion (declare needs, system provides)
```

## Resolution Patterns

### Separation Strategies

1. **Time Separation**: Different behavior at different stages
   ```
   Example: Cache with TTL - fast at read, consistent after expiry
   ```

2. **Space Separation**: Different behavior in different contexts
   ```
   Example: Strong auth for admin, lightweight for public
   ```

3. **Condition Separation**: Different behavior based on input
   ```
   Example: Eager loading for small datasets, lazy for large
   ```

4. **System-Level Change**: Add component that resolves both
   ```
   Example: Service mesh resolves coupling vs communication overhead
   ```

### Application Checklist

When facing a contradiction:

1. Is the contradiction real or assumed?
2. Can separation in time resolve it?
3. Can separation in space resolve it?
4. Can separation by condition resolve it?
5. Does adding a new component resolve it?
6. Check the contradiction matrix for specific principles
