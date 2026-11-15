# Migration Patterns

Database migration safety patterns. Updated for 2026 with zero-downtime and expanded rollback strategies.

## Overview

This guide covers safe patterns for evolving database schemas without downtime or data loss, incorporating the latest PostgreSQL 18 features and industry best practices.

## Migration Categories

### Schema Migrations
- Adding/removing tables
- Adding/removing columns
- Modifying column types
- Adding constraints/indexes

### Data Migrations
- Backfilling data
- Transforming existing data
- Splitting/merging columns
- Migrating between tables

## Safety-First Migration Strategy

### Phase 1: Deploy-Compatible Change

Make changes that work with both old and new code:

```sql
-- Add new column (nullable)
ALTER TABLE users ADD COLUMN display_name VARCHAR(255);

-- Backfill data gradually
UPDATE users 
SET display_name = username 
WHERE display_name IS NULL;
```

### Phase 2: Dual-Write Period

Both old and new columns are written:

```python
# Application code writes to both
def update_user(user_id, name):
    db.execute("""
        UPDATE users 
        SET username = %s,
            display_name = %s
        WHERE id = %s
    """, (name, name, user_id))
```

### Phase 3: Switch Read Path

Change code to read from new column:

```python
# Read from new column
def get_user(user_id):
    return db.execute("""
        SELECT id, display_name as name
        FROM users
        WHERE id = %s
    """, (user_id,))
```

### Phase 4: Cleanup

Remove old column after verification:

```sql
-- After confirming everything works
ALTER TABLE users DROP COLUMN username;
```

## Common Migration Patterns

### Adding a Non-Nullable Column

```sql
-- Step 1: Add as nullable
ALTER TABLE products ADD COLUMN sku VARCHAR(100);

-- Step 2: Backfill with default
UPDATE products SET sku = 'TEMP-' || id::text WHERE sku IS NULL;

-- Step 3: Make non-nullable
ALTER TABLE products ALTER COLUMN sku SET NOT NULL;

-- Step 4: Add unique constraint
ALTER TABLE products ADD CONSTRAINT unique_sku UNIQUE (sku);
```

### Splitting a Column

Split full_name into first_name and last_name:

```sql
-- Step 1: Add new columns
ALTER TABLE users ADD COLUMN first_name VARCHAR(100);
ALTER TABLE users ADD COLUMN last_name VARCHAR(100);

-- Step 2: Migrate data
UPDATE users 
SET 
    first_name = split_part(full_name, ' ', 1),
    last_name = split_part(full_name, ' ', 2)
WHERE full_name IS NOT NULL;

-- Step 3: Application uses new columns
-- ... deploy code changes ...

-- Step 4: Remove old column (after verification)
ALTER TABLE users DROP COLUMN full_name;
```

### Renaming a Column

```sql
-- Step 1: Add new column
ALTER TABLE orders ADD COLUMN customer_identifier UUID;

-- Step 2: Backfill
UPDATE orders 
SET customer_identifier = customer_id::UUID;

-- Step 3: Create trigger for sync
CREATE OR REPLACE FUNCTION sync_customer_id()
RETURNS TRIGGER AS $$
BEGIN
    NEW.customer_identifier = NEW.customer_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_customer
    BEFORE INSERT OR UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION sync_customer_id();

-- Step 4: Switch application to new column
-- ... deploy code ...

-- Step 5: Remove trigger and old column
DROP TRIGGER sync_customer ON orders;
ALTER TABLE orders DROP COLUMN customer_id;
```

## 2026 Zero-Downtime Migrations

### Online Index Creation

PostgreSQL supports concurrent index creation without locking:

```sql
-- Non-blocking index creation (2026: Still the gold standard)
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);

-- For partitioned tables in PG 18
CREATE INDEX CONCURRENTLY idx_orders_date ON orders(order_date);
-- Automatically created on all partitions
```

### 2026: REINDEX CONCURRENTLY

Rebuild indexes without locking (PostgreSQL 12+):

```sql
-- Rebuild an existing index without locking
REINDEX INDEX CONCURRENTLY idx_users_email;

-- Useful for index bloat remediation
```

### Table Rewrite with Minimal Locking

For major schema changes, use a shadow table:

```sql
-- Step 1: Create new table structure
CREATE TABLE users_v2 (
    LIKE users INCLUDING ALL,
    new_field VARCHAR(255)
);

-- Step 2: Copy data in batches
INSERT INTO users_v2 
SELECT *, NULL as new_field 
FROM users 
WHERE id > last_copied_id
ORDER BY id
LIMIT 10000;

-- Step 3: Set up replication/sync
CREATE OR REPLACE FUNCTION sync_to_v2()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO users_v2 VALUES (NEW.*, NULL);
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE users_v2 SET (col1, col2, ...) = (NEW.col1, NEW.col2, ...)
        WHERE id = NEW.id;
    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM users_v2 WHERE id = OLD.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_sync
AFTER INSERT OR UPDATE OR DELETE ON users
FOR EACH ROW EXECUTE FUNCTION sync_to_v2();

-- Step 4: Switch tables
BEGIN;
    ALTER TABLE users RENAME TO users_old;
    ALTER TABLE users_v2 RENAME TO users;
COMMIT;

-- Step 5: Cleanup
DROP TABLE users_old;
```

## 2026: Detach Partition CONCURRENTLY

PostgreSQL 14+ allows detaching partitions without blocking:

```sql
-- Old way: blocks operations
ALTER TABLE measurements DETACH PARTITION measurements_y2023m01;

-- 2026 way: non-blocking (PostgreSQL 14+)
ALTER TABLE measurements DETACH PARTITION measurements_y2023m01 CONCURRENTLY;

-- Benefits: Only requires SHARE UPDATE EXCLUSIVE lock
```

## 2026: MERGE Command

PostgreSQL 15+ introduces SQL-standard MERGE:

```sql
-- Upsert pattern with MERGE (2026)
MERGE INTO target_table t
USING source_table s
ON t.id = s.id
WHEN MATCHED THEN UPDATE SET
    t.value = s.value,
    t.updated_at = CURRENT_TIMESTAMP
WHEN NOT MATCHED THEN INSERT (id, value, created_at)
    VALUES (s.id, s.value, CURRENT_TIMESTAMP);
```

## Rollback Strategies

### Transaction-Based Rollback

```sql
-- Wrap in transaction
BEGIN;
    ALTER TABLE products ADD COLUMN new_field VARCHAR(255);
    -- If anything fails, ROLLBACK
COMMIT;
```

### Reverse Migration Script

Always create rollback scripts:

```sql
-- migration_001_add_column.sql
ALTER TABLE users ADD COLUMN preferences JSONB;

-- rollback_001_add_column.sql
ALTER TABLE users DROP COLUMN preferences;
```

### 2026: Idempotent Migrations

Make migrations rerunnable:

```sql
-- Idempotent column addition
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'preferences'
    ) THEN
        ALTER TABLE users ADD COLUMN preferences JSONB;
    END IF;
END $$;

-- Idempotent index creation
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_users_email'
    ) THEN
        CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
    END IF;
END $$;
```

## Validation Checks

### Pre-Migration Checks

```sql
-- Check for data that would violate new constraints
SELECT COUNT(*) 
FROM users 
WHERE email IS NULL;  -- Before adding NOT NULL constraint

-- Check table size for timing estimates
SELECT pg_size_pretty(pg_total_relation_size('users'));

-- 2026: Check for long-running transactions
SELECT * FROM pg_stat_activity 
WHERE state = 'active' AND xact_start < NOW() - INTERVAL '5 minutes';
```

### Post-Migration Verification

```sql
-- Verify constraint is working
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_name = 'users' AND constraint_name = 'unique_email';

-- Verify index is created
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'users';

-- 2026: Verify partition attachment
SELECT inhrelid::regclass AS partition
FROM pg_inherits
WHERE inhparent = 'measurements'::regclass;
```

## Migration Tools 2026

### Popular Tools

- **Flyway**: Version-based migrations, supports PostgreSQL 18
- **Liquibase**: XML/YAML/JSON migration definitions
- **Alembic**: SQLAlchemy migrations for Python
- **golang-migrate**: Go migration tool
- **Atlas**: Modern schema management with visualizations

### Migration Naming Convention

```
V1__initial_schema.sql
V2__add_users_table.sql
V3__add_email_index.sql
U3__rollback_add_email_index.sql
```

## Best Practices 2026

1. **Never modify existing migrations** after deployment
2. **Always test on a copy of production data**
3. **Keep migrations idempotent** when possible
4. **Use transactions** for atomic changes
5. **Monitor migration duration** during deployment windows
6. **Have rollback plan** ready before running migrations
7. **Document breaking changes** clearly
8. **Run migrations separately** from code deployment
9. **Use CREATE INDEX CONCURRENTLY** for production indexes
10. **Use DETACH CONCURRENTLY** for partition maintenance
