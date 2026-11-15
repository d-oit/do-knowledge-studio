---
name: database-devops
description: Database design, migration, and DevOps automation with safety patterns. Use for schema design, migration planning, query optimization, multi-database orchestration, and Infrastructure-as-Code. Includes rollback strategies, performance analysis, and cross-database synchronization.
license: MIT
---

# Database & DevOps

Database lifecycle management with DevOps practices for safe schema evolution, query optimization, and multi-database orchestration.

## When to Use

- **Schema design** - New database schema design and normalization
- **Migration planning** - Safe schema evolution with data transformations
- **Query optimization** - Index recommendations, query rewriting, performance tuning
- **Multi-database orchestration** - Cross-database transactions, data sync
- **Infrastructure-as-Code** - Terraform/Pulumi database provisioning
- **Backup/Recovery** - Automated backup strategies and disaster recovery

## Core Workflow

### Schema Design Phase
1. **Requirements gathering** - Data entities, relationships, access patterns
2. **Conceptual design** - ERD, entity relationships, cardinality
3. **Logical design** - Table structures, column types, constraints
4. **Physical design** - Indexing, partitioning, storage considerations
5. **Normalization review** - 3NF/BCNF compliance vs. denormalization needs

### Migration Planning Phase
1. **Analyze current schema** - Existing tables, constraints, indexes
2. **Define target state** - Desired schema changes
3. **Plan migration steps** - Ordered, idempotent operations
4. **Assess data impact** - Data transformations needed
5. **Design rollback** - Reversible operations where possible

### Execution Phase
1. **Test in staging** - Run migrations against production-like data
2. **Backup data** - Full backup before destructive changes
3. **Execute migration** - Apply changes with monitoring
4. **Verify integrity** - Check constraints, data consistency
5. **Update applications** - Deploy code changes

## Schema Design Patterns

### Audit Trail
```sql
ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
```

### Soft Delete
```sql
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP;
ALTER TABLE users ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;

-- Query excludes deleted
SELECT * FROM users WHERE is_deleted = FALSE;
```

### Multi-Tenancy
```sql
-- Shared table with tenant_id
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    -- ... columns
);
CREATE INDEX idx_orders_tenant ON orders(tenant_id);
```

See `references/schema-patterns.md` for event sourcing, temporal tables, and more.

## Migration Safety

### Expand-Contract Pattern
```sql
-- Phase 1: Add new column (nullable)
ALTER TABLE users ADD COLUMN email_normalized VARCHAR(255);

-- Phase 2: Backfill data in batches
UPDATE users SET email_normalized = LOWER(email) WHERE id BETWEEN 1 AND 1000;

-- Phase 3: Add constraint after backfill
ALTER TABLE users ALTER COLUMN email_normalized SET NOT NULL;
```

### Online Schema Change
```bash
# Percona Toolkit for MySQL
pt-online-schema-change \
    --alter "ADD COLUMN email_normalized VARCHAR(255)" \
    --execute \
    D=mydb,t=users
```

See `references/migration-patterns.md` for gh-ost, batching strategies, and zero-downtime patterns.

## Query Optimization

### Indexing Strategy
```sql
-- Composite index for multi-column queries
CREATE INDEX idx_orders_user_date ON orders(user_id, created_at);

-- Partial index for filtered queries
CREATE INDEX idx_active_users ON users(email) WHERE is_active = TRUE;

-- Expression index for computed values
CREATE INDEX idx_email_lower ON users(LOWER(email));
```

### Query Rewriting
```sql
-- Before: N+1 query
-- After: JOIN to avoid N+1
SELECT orders.*, users.name 
FROM orders
JOIN users ON orders.user_id = users.id
WHERE orders.user_id = 1;
```

See `references/query-optimization.md` for EXPLAIN analysis, covering indexes, and performance tuning.

## Infrastructure-as-Code

### Terraform Example
```hcl
resource "aws_db_instance" "main" {
  identifier           = "myapp-db"
  engine              = "postgres"
  engine_version      = "15.4"
  instance_class      = "db.t3.micro"
  allocated_storage   = 20
  
  backup_retention_period = 7
  storage_encrypted = true
  deletion_protection = true
}
```

See `references/iac-examples.md` for Pulumi, CloudFormation, and multi-cloud examples.

## Backup and Recovery

### Continuous Archiving
```bash
# PostgreSQL WAL archiving
wal_level = replica
archive_mode = on
archive_command = 'cp %p /backup/wal/%f'
```

See `references/backup-strategies.md` for point-in-time recovery, automated backups, and disaster recovery procedures.

## Quality Checklist

- [ ] Schema normalized to 3NF (or denormalization justified)
- [ ] Indexes created for common query patterns
- [ ] Foreign key constraints defined
- [ ] Migrations are idempotent
- [ ] Rollback procedure tested
- [ ] Full backup before destructive changes
- [ ] Query performance benchmarked
- [ ] Connection pooling configured
- [ ] Monitoring/alerting for slow queries
- [ ] Secrets managed externally

## References

- `references/schema-patterns.md` - Advanced schema design patterns
- `references/migration-patterns.md` - Migration safety patterns
- `references/query-optimization.md` - Performance tuning guide
- `references/iac-examples.md` - Terraform/Pulumi examples
- `references/backup-strategies.md` - Backup and recovery

## Integration with other skills

- **turso-db**: Use `turso-db` for Turso-specific SDKs, bidirectional sync patterns, and experimental features like MVCC, vector search, and encryption. Use `database-devops` for general schema design, migration safety, and Infrastructure-as-Code.
