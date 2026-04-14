# TRIZ 40 Inventive Principles - Software Edition

Adapted from Genrich Altshuller's original principles for software engineering.

## Core Principles

### 1. Segmentation
- Divide into independent parts
- **Software**: Microservices, modules, atomic functions
- **Agent Instructions**: Split monolithic prompts into skill files

### 2. Taking Out (Extraction)
- Separate interfering parts
- **Software**: Extract interfaces, separate concerns
- **Agent Instructions**: Isolate domain knowledge from behavior

### 3. Local Quality
- Make uniform → non-uniform
- **Software**: Context-specific implementations
- **Agent Instructions**: Task-specific skill loading

### 4. Asymmetry
- Change symmetrical → asymmetrical
- **Software**: Non-uniform data structures, priority queues
- **Agent Instructions**: Heavy knowledge in references/, load lazily

### 5. Merging (Consolidation)
- Combine operations
- **Software**: Batch processing, reduce round-trips
- **Agent Instructions**: Bundle related tools for specialized agents

### 6. Universality
- One object, multiple functions
- **Software**: Polymorphism, shared interfaces
- **Agent Instructions**: Single skill handles multiple task types

### 7. Nesting (Matrioshka)
- Place one inside another
- **Software**: Hierarchical structures, inheritance
- **Agent Instructions**: Nested AGENTS.md with precedence rules

### 8. Anti-Weight
- Counter weight with lift
- **Software**: Caching, connection pooling
- **Agent Instructions**: Pre-compute expensive operations

### 9. Preliminary Counteraction
- Preload to compensate
- **Software**: Warm-up, pre-allocation
- **Agent Instructions**: Pre-validate before critical path

### 10. Preliminary Action
- Perform required action in advance
- **Software**: Eager loading, pre-compilation
- **Agent Instructions**: Pre-fetch context before execution

### 11. Beforehand Cushioning
- Prepare emergency means
- **Software**: Circuit breakers, fallback paths
- **Agent Instructions**: Error recovery strategies in skills

### 12. Equipotentiality
- Limit position changes in potential field
- **Software**: Transparent persistence, data locality
- **Agent Instructions**: Consistent context across agent calls

### 13. Inversion (Do it in Reverse)
- Invert actions
- **Software**: Inversion of control, reverse proxies
- **Agent Instructions**: Pull-based instruction loading vs push

### 14. Spheroidality
- Replace linear with curved
- **Software**: Circular buffers, ring topologies
- **Agent Instructions**: Iterative refinement cycles

### 15. Dynamics
- Allow characteristics to change
- **Software**: Runtime config, hot-reloading, adapters
- **Agent Instructions**: Context-aware instruction loading

### 16. Partial or Excessive Actions
- Do slightly less or more
- **Software**: Approximation algorithms, perturbation analysis
- **Agent Instructions**: 80% solution first, refine later

### 17. Transition to New Dimension
- Move from 1D → 2D → 3D
- **Software**: Multi-layered architectures, abstraction layers
- **Agent Instructions**: Hierarchical instruction precedence

### 18. Mechanical Vibration
- Utilize oscillation
- **Software**: Retry with exponential backoff
- **Agent Instructions**: Iterative refinement loops

### 19. Periodic Action
- Use periodic vs continuous
- **Software**: Scheduling, cron jobs, batch operations
- **Agent Instructions**: Periodic context refresh vs continuous

### 20. Continuity of Useful Action
- Eliminate idle time
- **Software**: Pipeline parallelization, async operations
- **Agent Instructions**: Parallel agent execution

### 21. Rushing Through
- Conduct harmful actions at high speed
- **Software**: Quick failure, fast timeouts
- **Agent Instructions**: Fail-fast validation

### 22. Blessing in Disguise
- Use harmful factors for benefit
- **Software**: Error messages as debugging aids
- **Agent Instructions**: Failed attempts inform next iteration

### 23. Feedback
- Introduce feedback loops
- **Software**: Monitoring, metrics, logging
- **Agent Instructions**: Quality gates with feedback

### 24. Intermediary
- Use intermediary object
- **Software**: Message queues, API gateways
- **Agent Instructions**: Coordination agents between specialists

### 25. Self-Service
- Object services itself
- **Software**: Self-healing systems, auto-scaling
- **Agent Instructions**: Self-correcting agent loops

### 26. Copying
- Use copies instead of original
- **Software**: Immutability, snapshots, replicas
- **Agent Instructions**: Context snapshots for rollback

### 27. Cheap Short-Living
- Replace expensive with cheap
- **Software**: Serverless, spot instances
- **Agent Instructions**: Ephemeral sub-agents for one-off tasks

### 28. Mechanics Substitution
- Replace mechanical with optical/auditory
- **Software**: Event-driven over polling
- **Agent Instructions**: Reactive skill loading

### 29. Pneumatics and Hydraulics
- Use gas/liquid instead of solid
- **Software**: Streaming data, flow-based programming
- **Agent Instructions**: Streaming context updates

### 30. Flexible Shells and Thin Films
- Use flexible/porous boundaries
- **Software**: API versioning, backward compatibility
- **Agent Instructions**: Graceful skill versioning

### 31. Porous Materials
- Make object porous
- **Software**: Caching layers, CDN
- **Agent Instructions**: Multi-level context caching

### 32. Color Changes
- Change color/transparency
- **Software**: Logging levels, debug modes
- **Agent Instructions**: Verbosity control in instructions

### 33. Homogeneity
- Make interacting objects same material
- **Software**: Consistent data formats, shared types
- **Agent Instructions**: Unified instruction format

### 34. Discard and Recover
- Make objects easy to discard
- **Software**: Garbage collection, temp files
- **Agent Instructions**: Ephemeral agent contexts

### 35. Parameter Changes
- Change physical/chemical state
- **Software**: Configuration-driven behavior
- **Agent Instructions**: Parameterized skill templates

### 36. Phase Transitions
- Use phenomena during phase transitions
- **Software**: State machines, lifecycle hooks
- **Agent Instructions**: Skill activation/deactivation hooks

### 37. Thermal Expansion
- Use thermal expansion/contraction
- **Software**: Dynamic resource allocation
- **Agent Instructions**: Context scaling based on task complexity

### 38. Strong Oxidants
- Accelerate processes with enriched environments
- **Software**: Parallel processing, GPU acceleration
- **Agent Instructions**: Parallel agent spawning

### 39. Inert Environment
- Use neutral/inert environment
- **Software**: Sandboxing, containerization
- **Agent Instructions**: Isolated agent execution contexts

### 40. Composite Materials
- Use composite over homogeneous
- **Software**: Polyglot persistence, mixed architectures
- **Agent Instructions**: Hybrid instruction strategies
