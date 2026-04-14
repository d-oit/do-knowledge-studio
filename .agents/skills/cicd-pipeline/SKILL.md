---
name: cicd-pipeline
description: Design and implement CI/CD pipelines with GitHub Actions, GitLab CI, and Forgejo Actions. Use for automated testing, deployment strategies (blue-green, canary), security scanning, and multi-environment workflows. Includes pipeline optimization, secrets management, and failure handling patterns.
license: MIT
---

# CI/CD Pipeline

Design robust, secure, and efficient CI/CD pipelines with modern deployment strategies and comprehensive quality gates.

## When to Use

- **Setting up CI/CD** - New project pipelines or migrating existing ones
- **Deployment strategies** - Blue-green, canary, rolling deployments
- **Security integration** - SAST, DAST, secrets scanning in pipeline
- **Multi-environment workflows** - Dev, staging, production promotion
- **Pipeline optimization** - Speed, cost, reliability improvements
- **Failure handling** - Rollbacks, notifications, incident response

## Core Workflow

### Phase 1: Pipeline Design
1. **Define triggers** - Push, PR, schedule, manual, webhook
2. **Map environments** - Dev, staging, production requirements
3. **Identify stages** - Build, test, security, deploy, verify
4. **Choose strategy** - Continuous integration, delivery, or deployment
5. **Plan rollback** - Automatic or manual recovery procedures

### Phase 2: Implementation
1. **Create workflow files** - GitHub Actions, GitLab CI, etc.
2. **Configure jobs** - Dependencies, parallelism, matrix builds
3. **Add security gates** - Scanning, compliance checks
4. **Set up deployment** - Infrastructure provisioning, app deployment
5. **Configure notifications** - Slack, email, PagerDuty alerts

### Phase 3: Operations
1. **Monitor execution** - Duration, success rates, bottlenecks
2. **Optimize performance** - Caching, parallelization, job splitting
3. **Handle failures** - Alerts, rollbacks, incident response
4. **Maintain security** - Secret rotation, access reviews
5. **Document procedures** - Runbooks, troubleshooting guides

## Pipeline Stages

### Standard Stage Flow
```
Trigger → Lint → Build → Unit Test → Integration Test → Security Scan → Deploy Staging → E2E Test → Deploy Production → Verify
```

### Stage Definitions

| Stage | Purpose | Tools Examples | Duration Target |
|-------|---------|----------------|-----------------|
| **Lint** | Code style, formatting | ESLint, Prettier, Black, golangci-lint | < 1 min |
| **Build** | Compile, bundle, package | Docker, npm, cargo, maven | < 5 min |
| **Unit Test** | Fast, isolated tests | Jest, pytest, go test | < 3 min |
| **Integration Test** | Component interactions | TestContainers, database tests | < 5 min |
| **Security Scan** | Vulnerabilities, secrets | Trivy, SonarQube, GitLeaks | < 3 min |
| **Deploy Staging** | Pre-prod deployment | Helm, Terraform, kubectl | < 3 min |
| **E2E Test** | Full user workflows | Playwright, Cypress | < 10 min |
| **Deploy Prod** | Production release | Helm, ArgoCD, Spinnaker | < 5 min |
| **Verify** | Health checks, smoke tests | Curl, custom scripts | < 2 min |

**Total Target**: < 15 minutes for CI, deploy on demand or automated

## GitHub Actions Patterns

### Pattern 1: Reusable Workflow
```yaml
# .github/workflows/reusable-test.yml
name: Reusable Test Workflow

on:
  workflow_call:
    inputs:
      node_version:
        required: true
        type: string
      test_command:
        required: true
        type: string

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ inputs.node_version }}
          cache: 'npm'
      - run: npm ci
      - run: ${{ inputs.test_command }}
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: test-results
          path: test-results/
```

### Pattern 2: Matrix Builds
```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        node: [18, 20, 21]
        os: [ubuntu-latest, windows-latest]
        include:
          - node: 20
            os: ubuntu-latest
            coverage: true
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
      - run: npm ci
      - run: npm test
      - uses: codecov/codecov-action@v3
        if: matrix.coverage
```

### Pattern 3: Caching Strategy
See `references/optimization-patterns.md` for caching configuration.

### Pattern 4: Conditional Jobs
```yaml
jobs:
  deploy-production:
    if: github.ref == 'refs/heads/main'
    needs: [test, security-scan]
    runs-on: ubuntu-latest
    environment: production
    steps:
      - run: ./scripts/deploy.sh production
```

## Deployment Strategies

See `references/deployment-strategies.md` for detailed implementations of:
- Blue-green deployments
- Canary deployments with automatic promotion
- Rolling deployments in Kubernetes
- Feature flags and gradual rollouts

## Security Integration

See `references/security-scanning.md` for:
- Secrets detection with GitLeaks
- Dependency vulnerability scanning with Trivy
- SAST with SonarQube/CodeQL
- Container image scanning
- Compliance checking

## Multi-Environment Promotion

### Environment Protection
```yaml
# Require approvals for production
jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - run: ./scripts/deploy.sh staging

  deploy-production:
    runs-on: ubuntu-latest
    needs: deploy-staging
    environment: production  # Requires manual approval
    steps:
      - run: ./scripts/deploy.sh production
```

## Pipeline Optimization

See `references/optimization-patterns.md` for:
- Parallel job execution strategies
- Docker layer caching
- Test sharding and categorization
- Cost reduction techniques
- Caching best practices

## Failure Handling

See `references/failure-recovery.md` for:
- Automatic rollback procedures
- Health check implementations
- Slack/Teams notifications

## Forgejo Actions

Self-hosted CI/CD configuration using Forgejo/Gitea Actions.

## Quality Checklist

- [ ] Pipeline triggered on push/PR
- [ ] All tests run before deployment
- [ ] Security scans in pipeline
- [ ] Deployment requires approval for production
- [ ] Rollback procedure documented and tested
- [ ] Caching configured for speed
- [ ] Secrets managed via environment variables
- [ ] Notifications configured for failures
- [ ] Health checks post-deployment
- [ ] Pipeline duration under 15 minutes

## References

- `references/deployment-strategies.md` - Detailed deployment guides
- `references/security-scanning.md` - Security tool integration
- `references/optimization-patterns.md` - Performance optimization
- `references/failure-recovery.md` - Rollback and recovery
