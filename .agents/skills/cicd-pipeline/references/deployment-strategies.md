# Deployment Strategies

Detailed implementations of deployment strategies for CI/CD pipelines.

## Blue-Green Deployment

Blue-green deployment maintains two identical production environments. Only one is live at a time, allowing instant rollback by switching traffic.

### GitHub Actions with AWS
```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Blue Environment
        run: |
          aws elasticbeanstalk create-application-version \
            --application-name myapp \
            --version-label ${{ github.sha }} \
            --source-bundle S3Bucket=mybucket,S3Key=myapp.zip
          
          aws elasticbeanstalk update-environment \
            --environment-name myapp-blue \
            --version-label ${{ github.sha }}
      
      - name: Health Check
        run: |
          sleep 30
          curl -sf https://myapp-blue.example.com/health || exit 1
      
      - name: Swap Traffic
        run: |
          aws elasticbeanstalk swap-environment-cnames \
            --source-environment-name myapp-blue \
            --destination-environment-name myapp-green
```

### Kubernetes with Services
```yaml
apiVersion: v1
kind: Service
metadata:
  name: myapp
spec:
  selector:
    app: myapp
    version: blue  # Switch to green after deployment
  ports:
    - port: 80
      targetPort: 8080
```

## Canary Deployment

Gradually shift traffic to new version while monitoring metrics. Automatic rollback if error rate increases.

### Kubernetes with Flagger
```yaml
# Kubernetes with Flagger
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy Canary
        run: |
          kubectl apply -f k8s/canary/
          kubectl set image deployment/myapp \
            myapp=myregistry/myapp:${{ github.sha }}
      
      - name: Wait for Canary Analysis
        run: |
          kubectl wait canary/myapp \
            --for=condition=Promoted \
            --timeout=5m
```

### Istio Canary with Traffic Splitting
```yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: myapp
spec:
  hosts:
    - myapp.example.com
  http:
    - route:
        - destination:
            host: myapp
            subset: stable
          weight: 90
        - destination:
            host: myapp
            subset: canary
          weight: 10
```

## Rolling Deployment

Replace instances one at a time with zero downtime.

### Kubernetes Rolling Update
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1        # Run 1 extra pod during update
      maxUnavailable: 0  # Never go below 3 available
  template:
    spec:
      containers:
        - name: myapp
          image: myapp:${VERSION}
          readinessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 5
```

### AWS Auto Scaling Rolling Update
```bash
aws autoscaling start-instance-refresh \
    --auto-scaling-group-name myapp-asg \
    --strategy Rolling
```

## Feature Flags

Deploy code disabled by default, enable gradually.

### LaunchDarkly Integration
```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy with Feature Flags
        run: |
          # Deploy code with new feature disabled
          ./scripts/deploy.sh
          
      - name: Gradual Rollout
        run: |
          # Enable for 5% of users
          launchdarkly-flag update new-feature \
            --percentage 5
```

### Environment Variable Flags
```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Set Feature Flag
        run: |
          echo "NEW_FEATURE_ENABLED=false" >> $GITHUB_ENV
      
      - name: Deploy
        run: ./scripts/deploy.sh
      
      - name: Monitor
        run: |
          # Check metrics for 10 minutes
          sleep 600
          # Enable if healthy
          echo "NEW_FEATURE_ENABLED=true" >> $GITHUB_ENV
          ./scripts/update-config.sh
```

## A/B Testing Deployment

Deploy multiple versions and route traffic based on user segments.

```yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: myapp-ab-test
spec:
  hosts:
    - myapp.example.com
  http:
    - match:
        - headers:
            x-canary:
              exact: "true"
      route:
        - destination:
            host: myapp
            subset: canary
    - route:
        - destination:
            host: myapp
            subset: stable
          weight: 95
        - destination:
            host: myapp
            subset: canary
          weight: 5
```

## Deployment Decision Matrix

| Strategy | Zero Downtime | Rollback Speed | Resource Cost | Complexity | Best For |
|----------|---------------|----------------|---------------|------------|----------|
| **Blue-Green** | Yes | Instant | 2x | Medium | Critical apps, instant rollback needs |
| **Canary** | Yes | Fast (auto) | 1.1-1.5x | High | Gradual rollout, risk mitigation |
| **Rolling** | Yes | Slow | 1x | Low | Simple updates, stateless apps |
| **Feature Flags** | Yes | Instant | 1x | Medium | Continuous deployment, experiments |
| **A/B Test** | Yes | Fast | 1.5x | High | User research, validation |
| **Recreate** | No | N/A | 1x | Low | Dev environments, tolerant of downtime |
