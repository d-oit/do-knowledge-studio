# Backup Strategies

Database backup and recovery strategies. Updated for 2026 with latest PostgreSQL 18 and pgBackRest 2.58+.

## Overview

This guide covers backup strategies, tools, and procedures for ensuring data durability and recoverability using modern PostgreSQL features and tools.

## Backup Types

### Full Backups

Complete copy of the database:

```bash
# PostgreSQL pg_dump
pg_dump -h localhost -U dbadmin -Fc mydb > backup.dump

# With compression (2026: zstd is faster than custom format)
pg_dump -h localhost -U dbadmin -F c -Z 9 mydb > backup.dump

# Parallel dump for large databases (PostgreSQL 16+)
pg_dump -h localhost -U dbadmin -F d -j 4 mydb -f backup_dir
```

**Pros**: Complete restore from single file
**Cons**: Slow for large databases, resource-intensive

### Incremental Backups

Only backup changed data since last backup:

```bash
# PostgreSQL WAL archiving
# In postgresql.conf:
wal_level = replica
archive_mode = on
archive_command = 'pgbackrest --stanza=main archive-push %p'
# Or use wal-g for cloud storage:
# archive_command = 'wal-g wal-push %p'
```

**Pros**: Fast, small backup size
**Cons**: Need full backup + all incrementals to restore

### Continuous Archiving (Point-in-Time Recovery)

```bash
# Base backup with pgBackRest (2026 recommended)
pgbackrest --stanza=main backup --type=full

# WAL archiving enables point-in-time recovery
# Restore to any point after base backup
```

## Backup Tools

### PostgreSQL Native Tools

```bash
# pg_dump - logical backup
pg_dump -h prod-db -U postgres -Fc myapp > myapp_$(date +%Y%m%d).dump

# pg_dumpall - all databases
pg_dumpall -h prod-db -U postgres > full_backup.sql

# pg_basebackup - physical backup (2026: Use pgBackRest instead)
pg_basebackup -h prod-db -U replicator \
  -D /backups/$(date +%Y%m%d) -Ft -z -P
```

### pgBackRest 2.58 (2026 Recommended)

Modern backup and restore solution:

```ini
# /etc/pgbackrest/pgbackrest.conf
[global]
repo1-path=/var/lib/pgbackrest
repo1-retention-full=4
repo1-retention-diff=8
repo1-retention-archive-type=diff
repo1-retention-archive=2

# 2026: Enable all features
repo1-bundle=y
repo1-block=y
repo1-checksum-page=y

# S3-compatible storage (2026: Add multiple repos for redundancy)
repo2-type=s3
repo2-s3-bucket=my-backup-bucket
repo2-s3-endpoint=s3.amazonaws.com
repo2-path=/pgbackrest
repo2-retention-full=14

# Compression (zstd is fastest)
compress-type=zstd
compress-level=3

# Parallel processing
process-max=4

[main]
pg1-path=/var/lib/postgresql/18/main
pg1-port=5432
```

```bash
# Full backup
pgbackrest --stanza=main backup --type=full

# Incremental backup
pgbackrest --stanza=main backup --type=incr

# Differential backup
pgbackrest --stanza=main backup --type=diff

# Backup info
pgbackrest --stanza=main info

# Restore (2026: delta restore for large databases)
pgbackrest --stanza=main restore \
  --delta \
  --type=time \
  --target="2024-01-15 14:30:00"

# Check backup integrity
pgbackrest --stanza=main verify

# 2026: Backup expire with specific retention
pgbackrest --stanza=main expire \
  --set=20240101-120000F \
  --repo=1
```

### WAL-G (Cloud-Native)

Modern archival restoration tool for PostgreSQL:

```bash
# Configuration
export WALG_S3_PREFIX=s3://my-backup-bucket/wal
export AWS_ACCESS_KEY_ID=xxx
export AWS_SECRET_ACCESS_KEY=xxx

# Full backup
wal-g backup-push /var/lib/postgresql/18/main

# Continuous archiving (WAL)
wal-g wal-push /var/lib/postgresql/18/main/pg_wal/xxx

# Restore
wal-g backup-fetch /var/lib/postgresql/18/main LATEST

# 2026: Parallel backup
wal-g backup-push /var/lib/postgresql/18/main --parallel=4
```

### Barman (Enterprise)

```ini
# /etc/barman.conf
[main]
description = "Main Production DB"
conninfo = host=prod-db user=barman dbname=postgres
backup_method = postgres
archiver = on
streaming_archiver = on
slot_name = barman
retention_policy = RECOVERY WINDOW OF 7 DAYS
wal_retention_policy = main

# 2026: Parallel backup settings
parallel_jobs = 4

# Compression
compression = gzip

# AWS S3 support
cloud_provider = aws-s3
s3_bucket = my-backup-bucket
```

```bash
# Initialize server
barman check main

# Create backup
barman backup main

# List backups
barman list-backups main

# Restore
cd /var/lib/postgresql
barman recover main 20240101T120000 /var/lib/postgresql/data
```

## Cloud Backup Solutions 2026

### AWS RDS Automated Backups

```hcl
resource "aws_db_instance" "main" {
  # Automated backups with extended retention
  backup_retention_period = 35  # Maximum
  backup_window          = "03:00-04:00"
  
  # Enable cross-region snapshot copy
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
  
  # Enhanced monitoring
  monitoring_interval = 60
  
  # 2026: Enable Performance Insights
  performance_insights_enabled = true
  performance_insights_retention_period = 7
}

# Manual snapshot
aws rds create-db-snapshot \
  --db-instance-identifier production-db \
  --db-snapshot-identifier manual-$(date +%Y%m%d)

# 2026: Cross-region automated backup
resource "aws_db_instance_automated_backups_replication" "cross_region" {
  source_db_instance_arn = aws_db_instance.main.arn
  retention_period       = 14
  kms_key_id            = aws_kms_key.cross_region.arn
}
```

### Azure Database for PostgreSQL

```hcl
resource "azurerm_postgresql_flexible_server" "main" {
  backup_retention_days        = 35  # Maximum
  geo_redundant_backup_enabled = true
  
  # 2026: Auto-grow
  auto_grow_enabled = true
}

# 2026: Long-term retention
resource "azurerm_postgresql_flexible_server" "main_with_ltr" {
  # ... other settings
  
  maintenance_window {
    day_of_week  = 0
    start_hour   = 3
    start_minute = 0
  }
}
```

### Google Cloud SQL

```hcl
resource "google_sql_database_instance" "main" {
  settings {
    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      location                       = "us"
      transaction_log_retention_days = "7"
      backup_retention_settings {
        retained_backups = 30
        retention_unit   = "COUNT"
      }
      
      # 2026: Enable automated backups
      enabled_automated_backups = true
    }
  }
}
```

## Backup Verification

### Automated Verification

```bash
#!/bin/bash
# backup-verify.sh - 2026 enhanced version

BACKUP_FILE=$1
TEST_DB="backup_test_$(date +%s)"
LOG_FILE="/var/log/backup-verify.log"

echo "[$(date)] Starting backup verification..." >> $LOG_FILE

# Create test database
createdb -h localhost -U postgres $TEST_DB
if [ $? -ne 0 ]; then
    echo "[$(date)] ERROR: Failed to create test database" >> $LOG_FILE
    exit 1
fi

# Restore backup
echo "Restoring backup to test database..."
pg_restore -h localhost -U postgres -d $TEST_DB $BACKUP_FILE
if [ $? -ne 0 ]; then
    echo "[$(date)] ERROR: Restore failed" >> $LOG_FILE
    dropdb -h localhost -U postgres $TEST_DB
    exit 1
fi

# Run verification queries
psql -h localhost -U postgres -d $TEST_DB <<EOF
  SELECT 'Table count: ' || count(*) FROM information_schema.tables WHERE table_schema='public';
  SELECT 'Row count: ' || sum(n_live_tup) FROM pg_stat_user_tables;
  SELECT 'Extension count: ' || count(*) FROM pg_extension;
  -- 2026: Check for corruption
  SELECT 'Corruption check: ' || COUNT(*) FROM pg_class WHERE relkind = 'r' AND NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = oid LIMIT 1);
EOF

# 2026: Validate page checksums if enabled
psql -h localhost -U postgres -d $TEST_DB -c "SELECT pg_check_relation('pg_class');" 2>/dev/null

# Cleanup
dropdb -h localhost -U postgres $TEST_DB

echo "[$(date)] Backup verification complete" >> $LOG_FILE
```

### Checksum Validation

```bash
# Create backup with checksum (2026: pgBackRest does this automatically)
pg_dump -h prod-db -U postgres myapp | gzip > backup.sql.gz
md5sum backup.sql.gz > backup.sql.gz.md5

# Verify
md5sum -c backup.sql.gz.md5

# 2026: Use SHA256 for better security
sha256sum backup.sql.gz > backup.sql.gz.sha256
sha256sum -c backup.sql.gz.sha256
```

## Recovery Procedures

### Point-in-Time Recovery (PITR)

```bash
# Using pgBackRest (2026 recommended)
# 1. Stop PostgreSQL
pg_ctl stop -D /var/lib/postgresql/data

# 2. Restore with PITR
pgbackrest --stanza=main restore \
  --type=time \
  --target="2024-01-15 14:30:00" \
  --target-action=promote

# 3. Start PostgreSQL
pg_ctl start -D /var/lib/postgresql/data

# 4. Monitor recovery
psql -c "SELECT pg_last_xact_replay_timestamp();"
```

### Single Table Recovery

```bash
# Restore single table from dump
pg_restore -h localhost -U postgres -d myapp \
  --table=users --data-only backup.dump

# 2026: Use pgBackRest for selective restore
pgbackrest --stanza=main restore \
  --type=immediate \
  --db-include=myapp  # Only restore specific database
```

## Backup Retention

### Tiered Retention Policy

| Backup Type | Frequency | Retention |
|-------------|-----------|-----------|
| Full | Daily | 7 days |
| Full | Weekly | 4 weeks |
| Full | Monthly | 12 months |
| Differential | Daily | 7 days |
| Incremental | Hourly | 2 days |
| WAL | Continuous | 7 days |

### Automated Cleanup

```bash
#!/bin/bash
# cleanup-old-backups.sh - 2026 enhanced

BACKUP_DIR="/backups"
RETENTION_DAYS=30

# Find and remove old dumps
find $BACKUP_DIR -name "*.dump" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete

# Clean old WAL archives
find $BACKUP_DIR/wal -name "*.gz" -mtime +7 -delete

# 2026: pgBackRest automatic expiration
pgbackrest --stanza=main expire

echo "Cleanup complete"
```

## Disaster Recovery

### RPO and RTO

- **RPO (Recovery Point Objective)**: Maximum acceptable data loss (e.g., 5 minutes)
- **RTO (Recovery Time Objective)**: Maximum acceptable downtime (e.g., 1 hour)

### Cross-Region Replication 2026

```hcl
# AWS RDS Cross-Region Read Replica with automated backup
resource "aws_db_instance" "replica" {
  replicate_source_db = aws_db_instance.main.arn
  instance_class     = "db.t3.medium"
  
  # Different region for disaster recovery
  provider = aws.disaster_recovery
  
  # 2026: Enable backup on replica
  backup_retention_period = 7
}

# Azure Geo-Redundant Backup
resource "azurerm_postgresql_flexible_server" "main" {
  geo_redundant_backup_enabled = true
}

# GCP Cross-Region Replica
resource "google_sql_database_instance" "replica" {
  master_instance_name = google_sql_database_instance.main.name
  region               = "us-west1"
  
  replica_configuration {
    failover_target = false
  }
}
```

### Disaster Recovery Runbook

```markdown
## Database Disaster Recovery Runbook (2026 Edition)

### Scenario: Primary database unavailable

1. **Assess** (5 min)
   - Check monitoring alerts (CloudWatch/Prometheus)
   - Verify database status via CLI/API
   - Estimate recovery time from pgBackRest info

2. **Decide** (5 min)
   - If recovery < RTO: Attempt repair
   - If recovery > RTO: Initiate failover

3. **Failover** (15 min)
   - For pgBackRest: Restore from latest backup
     ```bash
     pgbackrest --stanza=main restore --type=immediate
     ```
   - For AWS RDS: Promote read replica
     ```bash
     aws rds promote-read-replica \
       --db-instance-identifier replica-db
     ```
   - Update application connection strings via ConfigMap/Secret
   - Verify connectivity with health check

4. **Verify** (15 min)
   - Check data consistency with checksums
   - Run smoke tests
   - Monitor error rates via dashboard
   - Verify replication lag if re-establishing primary

5. **Post-Incident** (within 24 hours)
   - Root cause analysis with timeline
   - Update runbook with lessons learned
   - Schedule disaster recovery drill
   - Review RPO/RTO targets
```

## Monitoring

### Backup Metrics

```yaml
# prometheus-alerts.yml - 2026 updated
- alert: BackupNotRunning
  expr: time() - pgbackrest_backup_last_completion_time > 90000
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "pgBackRest backup not running"

- alert: BackupSizeAnomaly
  expr: abs(pgbackrest_backup_size_bytes - pgbackrest_backup_size_bytes offset 1d) / pgbackrest_backup_size_bytes offset 1d > 0.5
  for: 15m
  labels:
    severity: warning
  annotations:
    summary: "Backup size changed significantly"

- alert: WALArchiveFailing
  expr: increase(pg_stat_archiver_failed_count[5m]) > 0
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "WAL archiving is failing"

- alert: PageChecksumFailures
  expr: pg_stat_database_checksum_failures > 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "Page checksum failures detected"
```

### pgBackRest Monitoring

```bash
# Check backup status
pgbackrest --stanza=main info --output=json | jq '.[] | {status: .status, timestamp: .timestamp}'

# Check WAL archive status
pgbackrest --stanza=main check
```

## Best Practices 2026

1. **3-2-1 Rule**: 3 copies, 2 different media, 1 offsite
2. **Test Restores**: Regularly verify backups are recoverable (monthly minimum)
3. **Monitor Backups**: Alert on backup failures within 15 minutes
4. **Document Procedures**: Keep runbooks updated and tested
5. **Encrypt Backups**: At rest and in transit (use KMS)
6. **Version Compatibility**: Test restore on target version
7. **Automate**: Schedule and verify automatically
8. **Use pgBackRest**: Modern backup solution with block-level incremental backups
9. **Enable Page Checksums**: Detect corruption early with `initdb --data-checksums`
10. **Multiple Repositories**: Configure local + cloud for redundancy
11. **Parallel Backup**: Use `--process-max` to speed up large database backups
12. **Verify Checksums**: Always verify backup integrity with `pgbackrest verify`
