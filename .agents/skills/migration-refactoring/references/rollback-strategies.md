# Rollback Strategies

Platform-specific rollback guides with 2026 Kubernetes and blue-green deployment updates.

## Overview

This guide covers rollback procedures for different platforms and deployment strategies, incorporating the latest practices for Kubernetes, blue-green deployments, and cloud platforms as of 2026.

## Application Rollback

### Blue-Green Deployment Rollback (2026 Update)

Based on Martin Fowler's Blue-Green Deployment pattern (2010) with modern Kubernetes and cloud enhancements:

```bash
#!/bin/bash
# blue-green-rollback.sh - Modern version with health verification

# Configuration
SERVICE_NAME="${1:-my-app}"
TARGET_COLOR="${2:-blue}"  # blue or green
DRY_RUN="${3:-false}"

# Get current active color
CURRENT_ACTIVE=$(kubectl get service $SERVICE_NAME -o jsonpath='{.spec.selector.color}')

if [ "$CURRENT_ACTIVE" = "$TARGET_COLOR" ]; then
    echo "✓ Target color ($TARGET_COLOR) is already active"
    exit 0
fi

echo "🔄 Blue-Green Rollback Initiated"
echo "   Current active: $CURRENT_ACTIVE"
echo "   Target: $TARGET_COLOR"
echo "   Dry run: $DRY_RUN"

# Pre-rollback health check
echo "🔍 Verifying target deployment health..."
if ! kubectl rollout status deployment/$SERVICE_NAME-$TARGET_COLOR --timeout=30s; then
    echo "❌ ERROR: Target deployment is not healthy"
    echo "   Attempting to check pod status..."
    kubectl get pods -l app=$SERVICE_NAME,color=$TARGET_COLOR
    kubectl describe deployment/$SERVICE_NAME-$TARGET_COLOR
    exit 1
fi

# Check pod readiness
READY_PODS=$(kubectl get deployment $SERVICE_NAME-$TARGET_COLOR -o jsonpath='{.status.readyReplicas}')
DESIRED_PODS=$(kubectl get deployment $SERVICE_NAME-$TARGET_COLOR -o jsonpath='{.spec.replicas}')

if [ "$READY_PODS" -lt "$DESIRED_PODS" ]; then
    echo "❌ ERROR: Only $READY_PODS/$DESIRED_PODS pods are ready"
    exit 1
fi

echo "✓ Target deployment is healthy ($READY_PODS/$DESIRED_PODS pods ready)"

if [ "$DRY_RUN" = "true" ]; then
    echo "🏃 DRY RUN: Would switch traffic to $TARGET_COLOR"
    exit 0
fi

# Switch traffic using patch
echo "🌐 Switching traffic to $TARGET_COLOR..."
kubectl patch service $SERVICE_NAME --type='json' -p='[{
    "op": "replace",
    "path": "/spec/selector/color",
    "value": "'$TARGET_COLOR'"
}]'

# Verify the switch
echo "⏳ Waiting for DNS propagation..."
sleep 5

# Health check after switch
MAX_RETRIES=5
RETRY_COUNT=0
ROLLBACK_TRIGGERED=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    echo "   Health check attempt $((RETRY_COUNT + 1))/$MAX_RETRIES..."
    
    if curl -sf http://$SERVICE_NAME/health; then
        echo "✅ Rollback to $TARGET_COLOR completed successfully"
        ROLLBACK_TRIGGERED=true
        break
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
        echo "   Retrying in 5 seconds..."
        sleep 5
    fi
done

# Rollback if health check failed
if [ "$ROLLBACK_TRIGGERED" = "false" ]; then
    echo "❌ Health check failed after switch"
    echo "🔄 Rolling back to $CURRENT_ACTIVE..."
    
    kubectl patch service $SERVICE_NAME --type='json' -p='[{
        "op": "replace",
        "path": "/spec/selector/color",
        "value": "'$CURRENT_ACTIVE'"
    }]'
    
    # Alert on-call team
    echo "🚨 CRITICAL: Automatic rollback triggered. Service may be unstable."
    # Send alert to PagerDuty/Opsgenie
    # curl -X POST $ALERT_ENDPOINT ...
    
    exit 1
fi

# Post-rollback verification
echo "🔍 Post-rollback verification..."

# Check error rate
ERROR_RATE=$(curl -sf http://$SERVICE_NAME/metrics | grep error_rate | awk '{print $2}')
if (( $(echo "$ERROR_RATE > 0.05" | bc -l) )); then
    echo "⚠️  WARNING: Error rate is elevated ($ERROR_RATE)"
    echo "   Monitoring for 60 seconds..."
    sleep 60
fi

echo "✅ Blue-green rollback completed successfully"
echo "   New active color: $TARGET_COLOR"
echo "   Error rate: ${ERROR_RATE:-N/A}"

# Log the rollback event
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Event
metadata:
  name: rollback-$(date +%s)
involvedObject:
  apiVersion: v1
  kind: Service
  name: $SERVICE_NAME
reason: BlueGreenRollback
message: "Rolled back from $CURRENT_ACTIVE to $TARGET_COLOR"
type: Normal
eventTime: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOF
```

### Canary Deployment Rollback

Based on Martin Fowler's Canary Release pattern (2014) with modern automated analysis:

```bash
#!/bin/bash
# canary-rollback.sh - Modern canary rollback with metrics-based decision

DEPLOYMENT="${1:-my-app}"
CANARY_PERCENTAGE="${2:-10}"  # Current canary percentage
FORCE="${3:-false}"

echo "🔄 Canary Rollback Initiated"
echo "   Deployment: $DEPLOYMENT"
echo "   Current canary percentage: $CANARY_PERCENTAGE%"

# Check if rollback is necessary based on metrics
if [ "$FORCE" != "true" ]; then
    echo "🔍 Analyzing canary metrics before rollback..."
    
    # Get error rates
    CANARY_ERRORS=$(kubectl exec deployment/$DEPLOYMENT-canary -- curl -s localhost:8080/metrics | grep error_rate | awk '{print $2}')
    STABLE_ERRORS=$(kubectl exec deployment/$DEPLOYMENT-stable -- curl -s localhost:8080/metrics | grep error_rate | awk '{print $2}')
    
    CANARY_LATENCY=$(kubectl exec deployment/$DEPLOYMENT-canary -- curl -s localhost:8080/metrics | grep latency_p99 | awk '{print $2}')
    STABLE_LATENCY=$(kubectl exec deployment/$DEPLOYMENT-stable -- curl -s localhost:8080/metrics | grep latency_p99 | awk '{print $2}')
    
    echo "   Canary error rate: $CANARY_ERRORS%"
    echo "   Stable error rate: $STABLE_ERRORS%"
    echo "   Canary P99 latency: ${CANARY_LATENCY}ms"
    echo "   Stable P99 latency: ${STABLE_LATENCY}ms"
    
    # Check if rollback criteria are met
    ERROR_THRESHOLD=5.0  # 5%
    LATENCY_THRESHOLD=500  # ms
    
    if (( $(echo "$CANARY_ERRORS > $ERROR_THRESHOLD" | bc -l) )) || \
       (( $(echo "$CANARY_LATENCY > $STABLE_LATENCY + $LATENCY_THRESHOLD" | bc -l) )); then
        echo "⚠️  Rollback criteria met - proceeding with rollback"
    else
        echo "✓ Canary metrics are within acceptable range"
        read -p "Are you sure you want to rollback? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Rollback cancelled"
            exit 0
        fi
    fi
fi

echo "🛑 Scaling down canary deployment..."
kubectl scale deployment $DEPLOYMENT-canary --replicas=0

# Wait for pods to terminate
echo "⏳ Waiting for canary pods to terminate..."
kubectl wait --for=delete pod -l app=$DEPLOYMENT-canary --timeout=60s

# Adjust traffic split to 100% stable
echo "🌐 Adjusting traffic to 100% stable..."
kubectl patch service $DEPLOYMENT -p '{"spec":{"selector":{"version":"stable"}}}'

# Verify stable deployment
echo "✓ Verifying stable deployment health..."
kubectl rollout status deployment/$DEPLOYMENT-stable --timeout=60s

echo "✅ Canary rollback complete"
echo "   100% traffic now on stable deployment"

# Log rollback event
kubectl create event \
  --reason=CanaryRollback \
  --message="Canary rollback from $CANARY_PERCENTAGE% to 0%" \
  --involved-object=deployment/$DEPLOYMENT
```

## Kubernetes Rollback Strategies (2026)

### Deployment Rollback

```bash
#!/bin/bash
# k8s-deployment-rollback.sh - Comprehensive Kubernetes rollback

DEPLOYMENT="${1:-my-app}"
NAMESPACE="${2:-default}"
REVISION="${3:-}"  # Optional: specific revision to rollback to

echo "🔧 Kubernetes Deployment Rollback"
echo "   Deployment: $DEPLOYMENT"
echo "   Namespace: $NAMESPACE"

# Get deployment history
echo "📜 Available revisions:"
kubectl rollout history deployment/$DEPLOYMENT -n $NAMESPACE

if [ -z "$REVISION" ]; then
    # Get previous revision
    CURRENT=$(kubectl get deployment $DEPLOYMENT -n $NAMESPACE -o jsonpath='{.metadata.annotations.kubernetes\.io/change-cause}')
    echo "   Current: $CURRENT"
    echo ""
    read -p "Enter revision number to rollback to (or press enter for previous): " REVISION
fi

if [ -z "$REVISION" ]; then
    echo "🔄 Rolling back to previous revision..."
    kubectl rollout undo deployment/$DEPLOYMENT -n $NAMESPACE
else
    echo "🔄 Rolling back to revision $REVISION..."
    kubectl rollout undo deployment/$DEPLOYMENT -n $NAMESPACE --to-revision=$REVISION
fi

# Wait for rollout
if kubectl rollout status deployment/$DEPLOYMENT -n $NAMESPACE --timeout=300s; then
    echo "✅ Rollback successful"
else
    echo "❌ Rollback failed - checking pod status..."
    kubectl get pods -n $NAMESPACE -l app=$DEPLOYMENT
    kubectl describe deployment/$DEPLOYMENT -n $NAMESPACE
    exit 1
fi

# Verify with health check
echo "🏥 Running health checks..."
for i in {1..5}; do
    if kubectl exec -n $NAMESPACE deployment/$DEPLOYMENT -- curl -sf localhost:8080/health > /dev/null 2>&1; then
        echo "✓ Health check $i/5 passed"
    else
        echo "✗ Health check $i/5 failed"
    fi
    sleep 2
done
```

### StatefulSet Rollback

```bash
#!/bin/bash
# statefulset-rollback.sh - StatefulSet rollback with persistent volume considerations

STATEFULSET="${1:-my-db}"
NAMESPACE="${2:-default}"

echo "🔧 StatefulSet Rollback"
echo "   StatefulSet: $STATEFULSET"
echo "   WARNING: StatefulSet rollback requires data compatibility check"

# Check persistent volume claims
echo "💾 Checking persistent volumes..."
kubectl get pvc -n $NAMESPACE -l app=$STATEFULSET

# Get current revision
CURRENT_REVISION=$(kubectl get statefulset $STATEFULSET -n $NAMESPACE -o jsonpath='{.metadata.generation}')
echo "   Current generation: $CURRENT_REVISION"

# StatefulSets don't support direct rollback - need to patch
echo "🔄 StatefulSet rollback requires manual image update..."
echo "   Previous images:"
kubectl rollout history statefulset/$STATEFULSET -n $NAMESPACE

read -p "Enter image tag to rollback to: " IMAGE_TAG

# Update StatefulSet with previous image
kubectl set image statefulset/$STATEFULSET \
  $STATEFULSET=$STATEFULSET:$IMAGE_TAG \
  -n $NAMESPACE

# Wait for rolling update
echo "⏳ Waiting for StatefulSet update..."
kubectl rollout status statefulset/$STATEFULSET -n $NAMESPACE --timeout=600s

# Verify pod readiness
for i in $(kubectl get pods -n $NAMESPACE -l app=$STATEFULSET -o name); do
    echo "Checking $i..."
    kubectl wait --for=condition=ready -n $NAMESPACE $i --timeout=120s
done

echo "✅ StatefulSet rollback completed"
```

### Helm Rollback

```bash
#!/bin/bash
# helm-rollback.sh - Helm release rollback

RELEASE="${1:-my-release}"
NAMESPACE="${2:-default}"
REVISION="${3:-0}"  # 0 means previous revision

echo "⎈ Helm Rollback"
echo "   Release: $RELEASE"
echo "   Namespace: $NAMESPACE"

# Get release history
echo "📜 Release history:"
helm history $RELEASE -n $NAMESPACE -o table

if [ "$REVISION" = "0" ]; then
    echo "🔄 Rolling back to previous revision..."
    helm rollback $RELEASE -n $NAMESPACE
else
    echo "🔄 Rolling back to revision $REVISION..."
    helm rollback $RELEASE $REVISION -n $NAMESPACE
fi

# Verify rollback
echo "🔍 Verifying rollback..."
helm status $RELEASE -n $NAMESPACE

# Test hooks if available
if helm test $RELEASE -n $NAMESPACE; then
    echo "✅ Helm tests passed"
else
    echo "⚠️  Helm tests failed - manual intervention may be required"
fi
```

## Database Rollback

### PostgreSQL Point-in-Time Recovery (2026)

```bash
#!/bin/bash
# pgsql-pitr-rollback.sh - Enhanced PITR with verification

TARGET_TIME="${1:-$(date -d '1 hour ago' '+%Y-%m-%d %H:%M:%S')}"
DATA_DIR="${DATA_DIR:-/var/lib/postgresql/data}"
BACKUP_DIR="${BACKUP_DIR:-/backups/base}"
WAL_DIR="${WAL_DIR:-/backups/wal}"
DRY_RUN="${2:-false}"

echo "🗄️  PostgreSQL Point-in-Time Recovery"
echo "   Target time: $TARGET_TIME"
echo "   Data directory: $DATA_DIR"
echo "   Dry run: $DRY_RUN"

# Validation
if [ "$DRY_RUN" = "false" ]; then
    # Confirm with user
    echo ""
    echo "⚠️  WARNING: This will destroy current database and restore to $TARGET_TIME"
    read -p "Type 'CONFIRM' to proceed: " CONFIRMATION
    if [ "$CONFIRMATION" != "CONFIRM" ]; then
        echo "Cancelled"
        exit 1
    fi
fi

# Step 1: Create pre-rollback backup
echo "📦 Creating pre-rollback backup..."
PRE_ROLLBACK_BACKUP="/tmp/pre-rollback-backup-$(date +%Y%m%d_%H%M%S).tar.gz"
pg_ctl stop -D $DATA_DIR -m fast
tar czf $PRE_ROLLBACK_BACKUP -C $(dirname $DATA_DIR) $(basename $DATA_DIR)
echo "   Pre-rollback backup: $PRE_ROLLBACK_BACKUP"

# Step 2: Clear data directory
echo "🧹 Clearing data directory..."
rm -rf $DATA_DIR/*

# Step 3: Restore base backup
echo "📥 Restoring base backup..."
tar xzf $BACKUP_DIR/latest.tar.gz -C $DATA_DIR

# Step 4: Configure recovery
echo "⚙️  Configuring PITR..."
cat > $DATA_DIR/postgresql.auto.conf <<EOF
restore_command = 'cp $WAL_DIR/%f %p'
recovery_target_time = '$TARGET_TIME'
recovery_target_action = 'pause'
recovery_target_inclusive = true
EOF

touch $DATA_DIR/recovery.signal

# Step 5: Start recovery
echo "🚀 Starting PostgreSQL in recovery mode..."
pg_ctl start -D $DATA_DIR -l $DATA_DIR/log/recovery.log

# Step 6: Monitor recovery progress
echo "⏳ Monitoring recovery..."
until psql -c "SELECT pg_is_in_recovery();" | grep -q "t"; do
    echo "   Waiting for recovery to start..."
    sleep 5
done

echo "   Recovery in progress..."
while psql -c "SELECT pg_is_in_recovery();" | grep -q "t"; do
    LSN=$(psql -t -c "SELECT pg_last_wal_receive_lsn();" 2>/dev/null || echo "unknown")
    echo "   Current LSN: $LSN"
    sleep 10
done

# Step 7: Verify recovery target
echo "✅ Recovery completed"
echo "🔍 Verifying recovery target..."
RESTORED_TIME=$(psql -t -c "SELECT pg_last_xact_replay_timestamp();")
echo "   Restored to: $RESTORED_TIME"

# Promote to primary
echo "📢 Promoting to primary..."
pg_ctl promote -D $DATA_DIR

# Verify database is writable
if psql -c "CREATE TABLE __rollback_test (id int); DROP TABLE __rollback_test;"; then
    echo "✅ Database is writable"
else
    echo "❌ Database is not writable - may still be in recovery"
    exit 1
fi

echo "✅ PITR rollback complete"
echo "   Target time: $TARGET_TIME"
echo "   Actual restored time: $RESTORED_TIME"
```

### MySQL Replication Failover

```bash
#!/bin/bash
# mysql-failover.sh - MySQL failover with GTID support

NEW_MASTER="${1:-replica1.example.com}"
MYSQL_USER="${MYSQL_USER:-admin}"
MYSQL_PASS="${MYSQL_PASS}"

echo "🔄 MySQL Failover"
echo "   New master: $NEW_MASTER"

# Get current master status
echo "📊 Checking current master..."
CURRENT_MASTER=$(mysql -e "SHOW SLAVE STATUS\G" | grep Master_Host | awk '{print $2}')
echo "   Current master: $CURRENT_MASTER"

# Check replication lag on new master
echo "🔍 Checking replication status on new master..."
REPLICA_LAG=$(mysql -h $NEW_MASTER -e "SHOW SLAVE STATUS\G" | grep Seconds_Behind_Master | awk '{print $2}')

if [ "$REPLICA_LAG" != "0" ]; then
    echo "⚠️  Warning: Replica is $REPLICA_LAG seconds behind"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 1. Stop writes on current master
echo "🛑 Stopping writes on current master..."
mysql -h $CURRENT_MASTER -e "FLUSH TABLES WITH READ LOCK; SET GLOBAL read_only = ON;"

# 2. Get replication position
MASTER_POS=$(mysql -h $CURRENT_MASTER -e "SHOW MASTER STATUS\G" | grep -E 'File|Position' | tr '\n' ' ')
echo "   Master position: $MASTER_POS"

# 3. Wait for replica to catch up
echo "⏳ Waiting for new master to catch up..."
mysql -h $NEW_MASTER -e "SELECT MASTER_POS_WAIT('$MASTER_POS');"

# 4. Stop replication on new master
echo "🛑 Stopping slave on new master..."
mysql -h $NEW_MASTER -e "STOP SLAVE; RESET SLAVE ALL;"

# 5. Enable writes on new master
echo "✅ Enabling writes on new master..."
mysql -h $NEW_MASTER -e "SET GLOBAL read_only = OFF; UNLOCK TABLES;"

# 6. Update application configuration (if using DNS)
echo "🌐 Updating DNS/application configuration..."
# This would typically involve updating a DNS record or service discovery

# 7. Reconfigure old master as replica (optional)
echo "🔄 Reconfiguring old master as replica..."
mysql -h $CURRENT_MASTER -e "RESET MASTER; CHANGE MASTER TO MASTER_HOST='$NEW_MASTER', MASTER_USER='repl', MASTER_PASSWORD='$REPL_PASS', MASTER_AUTO_POSITION=1; START SLAVE;"

echo "✅ Failover complete"
echo "   New master: $NEW_MASTER"
echo "   Old master (now replica): $CURRENT_MASTER"
```

## Cloud Platform Rollback

### AWS ECS Rollback

```bash
#!/bin/bash
# ecs-rollback.sh - AWS ECS service rollback

SERVICE_NAME="${1:-my-service}"
CLUSTER_NAME="${2:-my-cluster}"
REGION="${3:-us-east-1}"

echo "☁️  AWS ECS Rollback"
echo "   Service: $SERVICE_NAME"
echo "   Cluster: $CLUSTER_NAME"

# Get service details
echo "🔍 Getting service information..."
SERVICE_INFO=$(aws ecs describe-services \
    --cluster $CLUSTER_NAME \
    --services $SERVICE_NAME \
    --region $REGION \
    --query 'services[0]')

# Find previous stable task definition
echo "📜 Checking deployment history..."
DEPLOYMENTS=$(echo $SERVICE_INFO | jq -r '.deployments[] | select(.status == "PRIMARY")')

# Get current and previous task definitions
CURRENT_TASK_DEF=$(echo $SERVICE_INFO | jq -r '.taskDefinition')
PREVIOUS_TASK_DEF=$(aws ecs describe-services \
    --cluster $CLUSTER_NAME \
    --services $SERVICE_NAME \
    --region $REGION \
    --query 'services[0].deployments[?status==`ACTIVE`].taskDefinition' \
    --output text | head -1)

if [ -z "$PREVIOUS_TASK_DEF" ] || [ "$PREVIOUS_TASK_DEF" = "None" ]; then
    echo "❌ No previous stable deployment found"
    echo "   Current: $CURRENT_TASK_DEF"
    exit 1
fi

echo "   Current: $CURRENT_TASK_DEF"
echo "   Previous stable: $PREVIOUS_TASK_DEF"

# Update service to use previous task definition
echo "🔄 Rolling back to previous task definition..."
aws ecs update-service \
    --cluster $CLUSTER_NAME \
    --service $SERVICE_NAME \
    --task-definition $PREVIOUS_TASK_DEF \
    --force-new-deployment \
    --region $REGION

# Wait for stabilization
echo "⏳ Waiting for service to stabilize..."
aws ecs wait services-stable \
    --cluster $CLUSTER_NAME \
    --services $SERVICE_NAME \
    --region $REGION

# Verify health check
TASKS=$(aws ecs list-tasks \
    --cluster $CLUSTER_NAME \
    --service-name $SERVICE_NAME \
    --region $REGION \
    --query 'taskArns[]' \
    --output text)

for TASK in $TASKS; do
    echo "   Checking task: $TASK"
    aws ecs describe-tasks \
        --cluster $CLUSTER_NAME \
        --tasks $TASK \
        --region $REGION \
        --query 'tasks[0].healthStatus'
done

echo "✅ ECS rollback complete"
```

### Azure App Service Rollback

```powershell
# azure-app-service-rollback.ps1 - Modern Azure rollback

param(
    [Parameter(Mandatory=$true)]
    [string]$ResourceGroup,
    
    [Parameter(Mandatory=$true)]
    [string]$AppName,
    
    [string]$Slot = "production",
    [string]$TargetSlot = $null  # For slot swap rollback
)

Write-Host "☁️  Azure App Service Rollback" -ForegroundColor Cyan
Write-Host "   App: $AppName" -ForegroundColor Gray
Write-Host "   Resource Group: $ResourceGroup" -ForegroundColor Gray
Write-Host "   Slot: $Slot" -ForegroundColor Gray

# Get deployment history
Write-Host "`n📜 Retrieving deployment history..." -ForegroundColor Yellow
$deployments = az webapp deployment list `
    --resource-group $ResourceGroup `
    --name $AppName `
    --query '[?active==`true`] | sort_by(&active, &received_time) | reverse(@)' | ConvertFrom-Json

if ($deployments.Count -lt 2) {
    Write-Host "❌ Not enough deployment history for rollback" -ForegroundColor Red
    exit 1
}

$currentDeployment = $deployments[0]
$previousDeployment = $deployments[1]

Write-Host "   Current: $($currentDeployment.id) - $($currentDeployment.author) - $($currentDeployment.received_time)" -ForegroundColor Gray
Write-Host "   Previous: $($previousDeployment.id) - $($previousDeployment.author) - $($previousDeployment.received_time)" -ForegroundColor Gray

# If production slot, redeploy previous version
if ($Slot -eq "production") {
    Write-Host "`n🔄 Rolling back to previous deployment..." -ForegroundColor Yellow
    
    # Restore from deployment
    $result = az webapp deployment restore `
        --resource-group $ResourceGroup `
        --name $AppName `
        --deployment-id $previousDeployment.id
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Rollback completed successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ Rollback failed" -ForegroundColor Red
        exit 1
    }
} else {
    # Slot swap to rollback
    Write-Host "`n🔄 Performing slot swap rollback..." -ForegroundColor Yellow
    
    if (-not $TargetSlot) {
        $TargetSlot = "staging"
    }
    
    az webapp deployment slot swap `
        --resource-group $ResourceGroup `
        --name $AppName `
        --slot $TargetSlot `
        --target-slot $Slot
    
    Write-Host "✅ Slot swap rollback completed" -ForegroundColor Green
}

# Verify health
Write-Host "`n🏥 Running health check..." -ForegroundColor Yellow
$health = az webapp show `
    --resource-group $ResourceGroup `
    --name $AppName `
    --query 'state' --output tsv

if ($health -eq "Running") {
    Write-Host "✅ App is running" -ForegroundColor Green
} else {
    Write-Host "⚠️  App state: $health" -ForegroundColor Yellow
}
```

### GCP Cloud Run Rollback

```bash
#!/bin/bash
# gcp-cloud-run-rollback.sh - GCP Cloud Run revision rollback

SERVICE_NAME="${1:-my-service}"
REGION="${2:-us-central1}"
PROJECT="${3:-$(gcloud config get-value project)}"

echo "☁️  GCP Cloud Run Rollback"
echo "   Service: $SERVICE_NAME"
echo "   Region: $REGION"
echo "   Project: $PROJECT"

# List all revisions
echo "📜 Listing revisions..."
gcloud run revisions list \
    --service=$SERVICE_NAME \
    --region=$REGION \
    --project=$PROJECT \
    --format='table(metadata.name, status.conditions[0].status, metadata.creationTimestamp)'

# Find last healthy revision (excluding current)
echo "🔍 Finding previous healthy revision..."
REVISIONS=$(gcloud run revisions list \
    --service=$SERVICE_NAME \
    --region=$REGION \
    --project=$PROJECT \
    --format='value(metadata.name)')

# Skip current and find last healthy
CURRENT_REVISION=$(gcloud run services describe $SERVICE_NAME \
    --region=$REGION \
    --project=$PROJECT \
    --format='value(spec.template.metadata.name)')

echo "   Current revision: $CURRENT_REVISION"

# Find previous revision
FOUND_CURRENT=false
PREVIOUS_REVISION=""
for REV in $REVISIONS; do
    if [ "$FOUND_CURRENT" = "true" ]; then
        PREVIOUS_REVISION=$REV
        break
    fi
    if [ "$REV" = "$CURRENT_REVISION" ]; then
        FOUND_CURRENT=true
    fi
done

if [ -z "$PREVIOUS_REVISION" ]; then
    echo "❌ No previous revision found"
    exit 1
fi

echo "   Previous revision: $PREVIOUS_REVISION"

# Verify previous revision is healthy
echo "🏥 Checking health of previous revision..."
HEALTH=$(gcloud run revisions describe $PREVIOUS_REVISION \
    --region=$REGION \
    --project=$PROJECT \
    --format='value(status.conditions[0].status)')

if [ "$HEALTH" != "True" ]; then
    echo "⚠️  Warning: Previous revision is not healthy (status: $HEALTH)"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Rollback to previous revision
echo "🔄 Rolling back to $PREVIOUS_REVISION..."
gcloud run services update-traffic $SERVICE_NAME \
    --to-revisions=$PREVIOUS_REVISION=100 \
    --region=$REGION \
    --project=$PROJECT

echo "✅ Cloud Run rollback complete"
echo "   Traffic now 100% on revision: $PREVIOUS_REVISION"

# Monitor for a bit
echo "⏳ Monitoring for 30 seconds..."
sleep 30

# Check service health
SERVING=$(gcloud run services describe $SERVICE_NAME \
    --region=$REGION \
    --project=$PROJECT \
    --format='value(status.conditions[0].status)')

if [ "$SERVING" = "True" ]; then
    echo "✅ Service is serving traffic successfully"
else
    echo "⚠️  Service may have issues - check Cloud Console"
fi
```

## Feature Flag Rollback

### LaunchDarkly Emergency Rollback

```python
# launchdarkly-rollback.py - Modern emergency rollback
import ldclient
from ldclient.config import Config
from ldclient.context import Context
import os
import time
from typing import Optional, List

class LaunchDarklyRollbackManager:
    """Emergency rollback management for LaunchDarkly"""
    
    def __init__(self, sdk_key: Optional[str] = None):
        sdk_key = sdk_key or os.environ.get('LD_SDK_KEY')
        ldclient.set_config(Config(sdk_key))
        self.client = ldclient.get()
        
    def emergency_rollback(self, 
                           feature_key: str, 
                           environment: str = 'production',
                           verify: bool = True) -> dict:
        """
        Emergency rollback with verification.
        Instantly disables a feature flag.
        """
        result = {
            'success': False,
            'feature_key': feature_key,
            'environment': environment,
            'actions_taken': [],
            'verification_passed': False
        }
        
        try:
            # 1. Get current flag state for audit
            flag_state = self.client.variation_detail(feature_key, 
                                                       Context.builder('system').build(),
                                                       False)
            result['previous_state'] = flag_state
            
            # 2. Disable the flag
            self.client.update_feature_flag(
                feature_key,
                {
                    'on': False,
                    'offVariation': 0,
                    'fallthrough': {'variation': 0}
                }
            )
            result['actions_taken'].append('disabled_flag')
            
            # 3. Invalidate caches
            self._invalidate_caches(feature_key)
            result['actions_taken'].append('invalidated_caches')
            
            # 4. Send alert
            self._send_rollback_alert(feature_key, environment)
            result['actions_taken'].append('sent_alert')
            
            # 5. Verify rollback
            if verify:
                time.sleep(2)  # Wait for propagation
                verification = self._verify_rollback(feature_key)
                result['verification_passed'] = verification
                result['actions_taken'].append('verified_rollback')
            
            result['success'] = True
            result['timestamp'] = time.time()
            
        except Exception as e:
            result['error'] = str(e)
            result['actions_taken'].append('rollback_failed')
        
        return result
    
    def rollback_multiple(self, feature_keys: List[str],
                          environment: str = 'production') -> List[dict]:
        """Rollback multiple features in sequence"""
        results = []
        
        for key in feature_keys:
            result = self.emergency_rollback(key, environment, verify=False)
            results.append(result)
            
            if not result['success']:
                print(f"⚠️  Warning: Failed to rollback {key}, continuing...")
        
        # Verify all after batch update
        time.sleep(5)
        for result in results:
            if result['success']:
                result['verification_passed'] = self._verify_rollback(result['feature_key'])
        
        return results
    
    def _invalidate_caches(self, feature_key: str):
        """Invalidate CDN and application caches"""
        # This would integrate with your caching layer
        pass
    
    def _send_rollback_alert(self, feature_key: str, environment: str):
        """Send alert to on-call team"""
        # Integration with PagerDuty, Opsgenie, etc.
        pass
    
    def _verify_rollback(self, feature_key: str) -> bool:
        """Verify that flag is actually disabled"""
        context = Context.builder('verification').build()
        value = self.client.variation(feature_key, context, False)
        return value is False
```

## Rollback Decision Matrix (2026)

| Scenario | Detection Method | Recommended Action | Time to Complete | Verification Steps |
|----------|-----------------|-------------------|------------------|-------------------|
| **Critical error spike** | Error budget exhaustion, P99 latency > threshold | Immediate traffic switch | 1-2 minutes | Health checks, error rate < 1% |
| **Data corruption detected** | Database integrity checks, checksum failures | Stop writes + PITR | 15-30 minutes | Data consistency verification |
| **Security vulnerability** | Security scanning, threat detection | Immediate flag disable + rollback | < 1 minute | Vulnerability scan clean |
| **Performance degradation** | Latency SLO breach, throughput drop | Gradual rollback | 5-10 minutes | Performance benchmarks |
| **Partial AZ failure** | Availability zone health checks | Failover to healthy AZ | 5-15 minutes | Cross-AZ health verification |
| **Feature-specific issue** | Feature flag metrics, user complaints | Flag disable | < 1 minute | Feature functionality test |
| **Canary regression** | Statistical analysis of canary metrics | Canary termination | 2-5 minutes | Stable deployment metrics |
| **Configuration drift** | Infrastructure as code diff | Config re-apply | 3-5 minutes | Config validation |

## Automated Rollback Implementation (2026)

```python
# automated_rollback.py - Modern automated rollback system
import asyncio
from dataclasses import dataclass
from typing import Dict, Callable, Optional
from enum import Enum
import time

class RollbackTrigger(Enum):
    ERROR_RATE = "error_rate"
    LATENCY = "latency"
    BUSINESS_METRIC = "business_metric"
    MANUAL = "manual"
    PREDICTIVE = "predictive"

@dataclass
class RollbackConfig:
    max_error_rate: float = 0.05  # 5%
    max_latency_p99: float = 2000  # ms
    max_latency_p95: float = 1000  # ms
    business_metric_threshold: float = 0.90  # 90% of baseline
    cooldown_minutes: int = 30

class AutomatedRollbackSystem:
    """
    Modern automated rollback with ML-based prediction
    and multi-dimensional health checking.
    """
    
    def __init__(self, metrics_client, flag_client, alerting_client):
        self.metrics = metrics_client
        self.flags = flag_client
        self.alerting = alerting_client
        self.config = RollbackConfig()
        self.last_rollback_time = 0
        self.rollback_history = []
        
    async def evaluate_and_rollback(self, 
                                    deployment_id: str,
                                    feature_name: Optional[str] = None) -> Dict:
        """
        Evaluate deployment health and trigger rollback if needed.
        """
        # Check cooldown period
        if time.time() - self.last_rollback_time < (self.config.cooldown_minutes * 60):
            return {'action': 'skip', 'reason': 'cooldown_period'}
        
        # Collect metrics
        health = await self._collect_health_metrics(deployment_id)
        
        # Evaluate rollback triggers
        triggers = []
        
        if health['error_rate'] > self.config.max_error_rate:
            triggers.append((RollbackTrigger.ERROR_RATE, health['error_rate']))
        
        if health['latency_p99'] > self.config.max_latency_p99:
            triggers.append((RollbackTrigger.LATENCY, health['latency_p99']))
        
        if health['business_metric_ratio'] < self.config.business_metric_threshold:
            triggers.append((RollbackTrigger.BUSINESS_METRIC, health['business_metric_ratio']))
        
        # Check predictive signals (ML-based)
        predictive_risk = await self._predict_failure_risk(deployment_id)
        if predictive_risk > 0.8:  # 80% risk threshold
            triggers.append((RollbackTrigger.PREDICTIVE, predictive_risk))
        
        if not triggers:
            return {'action': 'none', 'health_score': health['overall']}
        
        # Execute rollback
        result = await self._execute_rollback(
            deployment_id, 
            feature_name,
            triggers
        )
        
        return result
    
    async def _collect_health_metrics(self, deployment_id: str) -> Dict:
        """Collect comprehensive health metrics"""
        return {
            'error_rate': await self.metrics.get_error_rate(deployment_id, minutes=5),
            'latency_p50': await self.metrics.get_latency_p50(deployment_id, minutes=5),
            'latency_p95': await self.metrics.get_latency_p95(deployment_id, minutes=5),
            'latency_p99': await self.metrics.get_latency_p99(deployment_id, minutes=5),
            'throughput': await self.metrics.get_throughput(deployment_id, minutes=5),
            'business_metric_ratio': await self.metrics.get_business_metric_ratio(deployment_id),
            'overall': await self.metrics.get_overall_health(deployment_id)
        }
    
    async def _predict_failure_risk(self, deployment_id: str) -> float:
        """ML-based failure risk prediction"""
        # Integration with ML model for predictive rollback
        # Placeholder implementation
        return 0.0
    
    async def _execute_rollback(self, 
                                deployment_id: str,
                                feature_name: Optional[str],
                                triggers: list) -> Dict:
        """Execute rollback with full audit trail"""
        rollback_start = time.time()
        
        # Log rollback initiation
        self.alerting.send_alert({
            'severity': 'critical',
            'title': f'Automated rollback triggered for {deployment_id}',
            'triggers': [{'type': t.value, 'value': v} for t, v in triggers]
        })
        
        # Execute rollback based on deployment type
        if feature_name:
            # Feature flag rollback
            await self._disable_feature_flag(feature_name)
        else
            # Full deployment rollback
            await self._rollback_deployment(deployment_id)
        
        # Verify rollback
        verification = await self._verify_rollback(deployment_id)
        
        rollback_duration = time.time() - rollback_start
        self.last_rollback_time = time.time()
        
        result = {
            'action': 'rollback_executed',
            'deployment_id': deployment_id,
            'triggers': [{'type': t.value, 'value': v} for t, v in triggers],
            'duration_seconds': rollback_duration,
            'verification_passed': verification,
            'timestamp': rollback_start
        }
        
        self.rollback_history.append(result)
        return result
```

## Testing Rollback Procedures

### Chaos Engineering Tests

```python
# test_rollback.py - Comprehensive rollback testing
import pytest
import asyncio
from datetime import datetime, timedelta

class TestRollbackProcedures:
    """Test suite for rollback procedures"""
    
    @pytest.mark.asyncio
    async def test_blue_green_switch(self, rollback_manager):
        """Verify traffic switch works and is reversible"""
        # Start with blue
        await rollback_manager.switch_traffic('blue')
        assert await rollback_manager.get_active_color() == 'blue'
        
        # Switch to green
        result = await rollback_manager.switch_traffic('green')
        assert result.success
        assert await rollback_manager.get_active_color() == 'green'
        
        # Verify health
        health = await rollback_manager.check_health()
        assert health.healthy
        assert health.error_rate < 0.01
        
        # Switch back (rollback test)
        result = await rollback_manager.switch_traffic('blue')
        assert result.success
    
    @pytest.mark.asyncio
    async def test_canary_termination(self, canary_manager):
        """Test canary deployment rollback"""
        # Start canary at 10%
        await canary_manager.start_canary(percentage=10)
        
        # Simulate failure
        await canary_manager.inject_error()
        
        # Verify automatic rollback
        result = await canary_manager.wait_for_rollback(timeout=60)
        assert result.rollback_triggered
        assert result.final_percentage == 0
    
    @pytest.mark.asyncio
    async def test_database_pitr(self, db_manager):
        """Test database point-in-time recovery"""
        # Record timestamp
        before_time = datetime.now()
        
        # Make a change
        await db_manager.insert_test_data()
        
        # Rollback to before change
        result = await db_manager.rollback_to_time(before_time)
        
        assert result.success
        assert result.data_loss_seconds < 5
        
        # Verify data state
        count = await db_manager.count_test_data()
        assert count == 0  # Data was rolled back
```

## Best Practices (2026 Update)

1. **Automated Detection**: Use ML-based anomaly detection to trigger rollbacks before human operators notice issues

2. **Graduated Rollback**: Implement staged rollbacks (100% → 50% → 0%) for gradual failure scenarios

3. **Rollback Drills**: Run chaos engineering exercises that specifically test rollback procedures monthly

4. **Time-to-Recovery (TTR) Goals**: 
   - Critical errors: < 2 minutes
   - Performance degradation: < 5 minutes
   - Data corruption: < 15 minutes

5. **Rollback Metrics**: Track and optimize:
   - Mean time to detect (MTTD)
   - Mean time to rollback (MTTR)
   - False positive rate
   - Rollback success rate

6. **Post-Rollback Analysis**: Mandatory post-mortem within 24 hours of any rollback

7. **Immutable Infrastructure**: Use immutable deployment patterns to ensure consistent rollback targets

## References

- Martin Fowler - Blue-Green Deployment: https://martinfowler.com/bliki/BlueGreenDeployment.html
- Martin Fowler - Canary Release: https://martinfowler.com/bliki/CanaryRelease.html
- Kubernetes Deployment Rollback: https://kubernetes.io/docs/concepts/workloads/controllers/deployment/
- AWS ECS Deployment Guide: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployments.html
- Google Cloud Run Revisions: https://cloud.google.com/run/docs/managing/revisions
