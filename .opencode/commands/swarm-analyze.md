---
description: Swarm analysis of codebase for gaps - features, implementation, docs, evals, tests
subtask: false
---

Perform a comprehensive swarm analysis of the codebase using the analysis-swarm agent.

Analyze from these perspectives:
1. **Feature Gaps** - Missing capabilities users would expect
2. **Implementation Completeness** - Stubs, TODOs, missing error handling
3. **Documentation Gaps** - Undocumented APIs, complex logic, setup instructions
4. **Test Coverage** - Untested code, missing integration tests
5. **Architecture & Patterns** - Design patterns, coupling, extensibility
6. **Security & Quality** - Security concerns, code quality issues

For each gap found, report:
- What's missing or incomplete
- Why it matters
- Priority (Critical/High/Medium/Low)
- Suggested fix or approach

Also identify quick wins, issues confirmed by multiple perspectives, and dependencies between gaps.

Save findings to `analysis/SWARM_ANALYSIS.md`.
