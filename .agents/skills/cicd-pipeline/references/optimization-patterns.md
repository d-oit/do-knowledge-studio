# Optimization Patterns

Performance optimization patterns for CI/CD pipelines.

## Overview

This guide covers techniques to optimize CI/CD pipeline performance, reduce build times, and minimize resource usage. Updated with latest 2026 practices.

## Build Optimization

### Parallel Execution

Split independent jobs to run in parallel:

```yaml
jobs:
  test-unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm test:unit
  
  test-integration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm test:integration
  
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm run lint
```

### Matrix Builds

Test multiple configurations simultaneously with max-parallel control:

```yaml
strategy:
  matrix:
    node-version: [18, 20, 22]
    os: [ubuntu-latest, windows-latest]
  fail-fast: false
  max-parallel: 4  # Limit concurrent jobs
```

**2026 Update**: Use `max-parallel` to control concurrency and resource usage across matrix jobs.

## Caching Strategies

### Dependency Caching

Cache package managers to speed up installs. **Updated for 2026**: Prefer `setup-*` actions with built-in caching:

```yaml
# Recommended: setup-* actions with automatic caching
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'  # Enables automatic caching
```

For custom caching needs, use `actions/cache@v4`:

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-
```

**2026 Caching Best Practices**:
- Keys have a maximum length of 512 characters
- Cache size limits: 10 GB default per repository (up to 10 TB configurable)
- Rate limits: 200 uploads/minute, 1500 downloads/minute per repository
- 7-day retention for unused caches

### Build Cache

Cache compilation outputs:

```yaml
- uses: actions/cache@v4
  with:
    path: |
      ~/.cargo/registry
      ~/.cargo/git
      target/
    key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}
```

## Docker Optimization

### Layer Caching

Order Dockerfile instructions by change frequency:

```dockerfile
# Dependencies change less frequently
COPY package*.json ./
RUN npm ci

# Application code changes frequently
COPY . .
RUN npm run build
```

### Multi-stage Builds

Reduce final image size:

```dockerfile
# Build stage
FROM node:20 AS builder
WORKDIR /app
COPY . .
RUN npm ci && npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/main.js"]
```

## Artifact Management

### Upload Optimization

**2026 Update**: Support for non-zipped artifacts (v7/v8):

```yaml
# Non-zipped single file (viewable in browser)
- uses: actions/upload-artifact@v4
  with:
    name: test-report
    path: test-report.html
    archive: false  # New in 2026 - skip zipping
    retention-days: 5

# Multiple files (still zipped)
- uses: actions/upload-artifact@v4
  with:
    name: build-output
    path: |
      dist/
      !dist/**/*.map  # Exclude source maps
    retention-days: 5
```

**Note**: `archive: false` requires actions/upload-artifact@v4 and actions/download-artifact@v5.

### Artifact Size Limits

Monitor and limit artifact sizes:

```yaml
- name: Check artifact size
  run: |
    du -sh dist/
    if [[ $(du -sb dist/ | cut -f1) -gt 104857600 ]]; then
      echo "Artifact exceeds 100MB limit"
      exit 1
    fi
```

## Runner Optimization

### Custom Images for GitHub-hosted Runners (2026 GA)

**New in 2026**: Build custom VM images with pre-installed tools for faster, more consistent workflows:

- Start with GitHub-curated base images
- Add your tools, dependencies, certificates
- Reduce setup time and operational overhead
- Greater control over build environments

See [Using custom images](https://docs.github.com/actions/how-tos/manage-runners/larger-runners/use-custom-images)

### Self-hosted Runners

Use self-hosted runners for specific workloads:

- GPU-intensive tasks
- Large memory requirements
- Specialized hardware
- Network-constrained environments

**2026 Update**: Allow traffic to `ghcr.io` and `*.actions.githubusercontent.com` for Immutable Actions.

### Runner Sizing

Choose appropriate runner sizes:

| Job Type | Recommended |
|----------|-------------|
| Lint/Format | ubuntu-latest (2-core) |
| Unit Tests | ubuntu-latest (4-core) |
| Integration Tests | ubuntu-latest (8-core) |
| Build | ubuntu-latest (larger runner) |

**Note**: Ubuntu-latest migrated to Ubuntu 24 (completed January 2025). Some packages were removed; verify your dependencies.

## Concurrency Control

**2026 Best Practice**: Limit concurrent deployments:

```yaml
concurrency:
  group: production-deployment
  cancel-in-progress: false  # Set true to cancel outdated runs
```

For PR-based workflows:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true
```

## Pipeline Optimization Checklist

- [ ] Enable job parallelization
- [ ] Implement dependency caching (use setup-* actions where possible)
- [ ] Use matrix builds with max-parallel for testing variants
- [ ] Optimize Docker layer caching
- [ ] Use non-zipped artifacts for single files (v7+)
- [ ] Minimize artifact uploads
- [ ] Use appropriate runner sizes or custom images
- [ ] Configure concurrency controls for deployments
- [ ] Remove unused dependencies
- [ ] Implement incremental builds where possible

## References

- [GitHub Actions Caching](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/caching-dependencies-to-speed-up-workflows)
- [Custom Images for Runners](https://github.blog/changelog/2026-03-26-custom-images-for-github-hosted-runners-are-now-generally-available/)
- [Non-zipped Artifacts](https://github.blog/changelog/2026-02-26-github-actions-now-supports-uploading-and-downloading-non-zipped-artifacts/)
