# Failure Recovery

Rollback and recovery strategies for CI/CD pipeline failures. Updated with 2026 best practices.

## Overview

This guide covers strategies for handling failures in CI/CD pipelines and recovering gracefully, including the latest GitHub Actions features for deployment management.

## Types of Failures

### Build Failures

- Compilation errors
- Dependency resolution failures
- Test failures
- Lint/formatting violations

### Deployment Failures

- Infrastructure provisioning errors
- Service startup failures
- Health check failures
- Timeout errors

### Environment Failures

- Network connectivity issues (including VNET failover scenarios - 2026)
- Resource exhaustion (disk, memory)
- External service outages
- Permission/authentication errors

## Concurrency and Deployment Control

**2026 Best Practice**: Use concurrency to prevent deployment conflicts:

```yaml
concurrency:
  group: production-environment
  cancel-in-progress: false  # Ensures only one deployment at a time
```

For controlled rollbacks with concurrency:

```yaml
deploy:
  runs-on: ubuntu-latest
  environment: production  # Enables deployment protection rules
  concurrency:
    group: production-deployment
    cancel-in-progress: false
  steps:
    - uses: actions/checkout@v4
    - name: Deploy
      run: ./deploy.sh
```

## Failure Detection

### Health Checks

```yaml
- name: Verify deployment
  run: |
    for i in {1..30}; do
      if curl -f http://localhost:8080/health; then
        echo "Service is healthy"
        exit 0
      fi
      sleep 10
    done
    echo "Health check failed"
    exit 1
```

### Smoke Tests

Quick validation after deployment:

```bash
#!/bin/bash
# smoke-test.sh
set -e

echo "Testing critical endpoints..."
curl -f http://api.example.com/health
curl -f http://api.example.com/api/v1/status
echo "All smoke tests passed"
```

## Recovery Strategies

### Automatic Retry

```yaml
- name: Deploy to production
  run: ./deploy.sh
  # Retry on transient failures
  if: failure()
  continue-on-error: false
```

### Rollback Procedures

#### Blue-Green Rollback

```bash
#!/bin/bash
# rollback.sh
set -e

echo "Initiating rollback..."

# Switch traffic back to previous version
kubectl patch service app-service \
  -p '{"spec":{"selector":{"version":"v1.2.3"}}}'

# Verify rollback
sleep 30
kubectl rollout status deployment/app-v1.2.3

echo "Rollback complete"
```

#### GitHub Actions Deployment Rollback

**2026 Update**: Using environments with required reviewers for rollback approval:

```yaml
rollback:
  runs-on: ubuntu-latest
  environment:
    name: production
    url: ${{ steps.deploy.outputs.url }}
  steps:
    - uses: actions/checkout@v4
      with:
        ref: ${{ github.event.inputs.previous_version }}
    
    - name: Rollback to previous version
      run: |
        echo "Rolling back to ${{ github.event.inputs.previous_version }}"
        ./deploy.sh --version ${{ github.event.inputs.previous_version }}
    
    - name: Verify rollback
      run: ./smoke-test.sh
```

#### Database Rollback

```sql
-- rollback-migration.sql
BEGIN TRANSACTION;

-- Reverse the migration
ALTER TABLE users DROP COLUMN new_field;

-- Restore from backup if needed
-- RESTORE DATABASE myapp FROM DISK = 'backup.bak'

COMMIT;
```

### Circuit Breaker Pattern

Prevent cascading failures:

```python
import time
from enum import Enum

class CircuitState(Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"

class CircuitBreaker:
    def __init__(self, failure_threshold=5, timeout=60):
        self.failure_threshold = failure_threshold
        self.timeout = timeout
        self.failure_count = 0
        self.last_failure_time = None
        self.state = CircuitState.CLOSED
    
    def call(self, func, *args, **kwargs):
        if self.state == CircuitState.OPEN:
            if time.time() - self.last_failure_time > self.timeout:
                self.state = CircuitState.HALF_OPEN
            else:
                raise Exception("Circuit breaker is OPEN")
        
        try:
            result = func(*args, **kwargs)
            self._on_success()
            return result
        except Exception as e:
            self._on_failure()
            raise e
    
    def _on_success(self):
        self.failure_count = 0
        self.state = CircuitState.CLOSED
    
    def _on_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold:
            self.state = CircuitState.OPEN
```

## Advanced Security and Rollback (2026)

### OIDC Token Claims for Rollback Authorization

**New in 2026**: Repository custom properties in OIDC tokens enable granular rollback authorization:

```yaml
# Workflow with OIDC custom properties for rollback control
rollback:
  runs-on: ubuntu-latest
  permissions:
    id-token: write
    contents: read
  steps:
    - name: Configure AWS Credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
        aws-region: us-east-1
    
    - name: Execute rollback with IAM conditions
      run: |
        # Cloud provider can validate repository custom properties
        # in the OIDC token claims for fine-grained access control
        aws deploy rollback
```

### VNET Failover Support (April 2026)

For Azure private networking with GitHub-hosted runners:

- Configure secondary Azure subnet (optionally different region)
- Automatic failover during regional outages
- Manual failover via UI or REST API
- Audit log events and email notifications

See [Azure private networking documentation](https://docs.github.com/enterprise-cloud@latest/admin/configuring-settings/configuring-private-networking-for-hosted-compute-products/about-azure-private-networking-for-github-hosted-runners-in-your-enterprise)

## Monitoring and Alerting

### Failure Metrics

Track key metrics:
- Deployment frequency
- Lead time for changes
- Mean time to recovery (MTTR)
- Change failure rate
- Rollback rate (alert if > 10%)

### Alerting Rules

```yaml
# prometheus-alerts.yml
groups:
  - name: deployment-alerts
    rules:
      - alert: DeploymentFailure
        expr: deployment_status{status="failed"} > 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Deployment failed"
          
      - alert: HighRollbackRate
        expr: rate(deployment_rollback_total[1h]) > 0.1
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High rollback rate detected"
```

### Webhook Rate Limits (2026)

**Update**: Each repository is limited to 1500 triggered events every 10 seconds. Plan rollback automation accordingly.

## Post-Incident Procedures

### Incident Response

1. **Detect**: Automated monitoring alerts
2. **Assess**: Evaluate impact and scope
3. **Respond**: Execute rollback or fix-forward
4. **Resolve**: Verify service restoration
5. **Review**: Post-mortem analysis

### Rollback Decision Matrix

| Scenario | Recommended Action | Time Limit |
|----------|-------------------|------------|
| Health check fails | Automatic rollback | 5 minutes |
| Smoke test fails | Automatic rollback | 10 minutes |
| Error rate > 1% | Manual rollback decision | 15 minutes |
| Performance degradation | Evaluate before rollback | 30 minutes |
| Partial feature issue | Feature flag disable | Immediate |

### Post-Mortem Template

```markdown
## Incident Summary
- Date: YYYY-MM-DD
- Duration: HH:MM
- Severity: SEV-1/SEV-2/SEV-3

## Impact
- Services affected: 
- User impact:
- Data loss: Y/N

## Root Cause
Detailed explanation of what caused the failure.

## Timeline
- HH:MM - Detection
- HH:MM - Response started
- HH:MM - Resolution

## Lessons Learned
- What went well
- What could be improved
- Action items

## Action Items
- [ ] Fix root cause
- [ ] Update runbooks
- [ ] Improve monitoring
```

## Best Practices

1. **Fail Fast**: Detect failures quickly and stop the pipeline
2. **Isolate Failures**: Prevent cascading failures with circuit breakers
3. **Automated Recovery**: Implement automatic rollback for critical failures
4. **Test Rollbacks**: Regularly test rollback procedures in staging
5. **Document Runbooks**: Have clear procedures for common failure scenarios
6. **Blameless Culture**: Focus on system improvements, not individual blame
7. **Use Concurrency Controls**: Prevent conflicting deployments
8. **Version Pinning**: Pin rollback target versions explicitly
9. **Canary Releases**: Deploy to subset first for early detection
10. **Feature Flags**: Enable/disable features without redeployment

## References

- [GitHub Actions Deployment](https://docs.github.com/en/actions/deployment/about-deployments/deploying-with-github-actions)
- [Environments for Deployment](https://docs.github.com/en/actions/deployment/targeting-different-environments/managing-environments-for-deployment)
- [Custom Images for Runners](https://github.blog/changelog/2026-03-26-custom-images-for-github-hosted-runners-are-now-generally-available/)
- [Azure VNET Failover](https://github.blog/changelog/2026-04-02-github-actions-early-april-2026-updates/)
