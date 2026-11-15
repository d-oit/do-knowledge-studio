# Schema Patterns

Advanced database schema design patterns. Updated for 2026 PostgreSQL 18.x best practices.

## Overview

This guide covers common database schema design patterns for reliability, performance, and maintainability based on the latest PostgreSQL 18 documentation and industry practices.

## Multi-Tenancy Patterns

### Shared Database, Separate Schema

Each tenant has isolated schemas in a shared database:

```sql
-- tenant_123.users
CREATE SCHEMA tenant_123;
CREATE TABLE tenant_123.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- tenant_456.users
CREATE SCHEMA tenant_456;
CREATE TABLE tenant_456.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Pros**: Data isolation, customizable per tenant
**Cons**: Schema management complexity, harder to scale

### Shared Database, Shared Schema

All tenants share the same schema with a tenant_id column:

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id INTEGER NOT NULL,
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, email)
);

-- Always filter by tenant_id
CREATE INDEX idx_users_tenant ON users(tenant_id);
```

**Pros**: Simpler schema management, easier to scale
**Cons**: Risk of data leakage if queries forget tenant filter

## Soft Delete Pattern

Instead of hard-deleting, mark records as deleted:

```sql
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    deleted_at TIMESTAMP,
    -- ... other columns
);

-- Create view for active records
CREATE VIEW active_products AS
SELECT * FROM products WHERE deleted_at IS NULL;

-- Soft delete
UPDATE products SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?;

-- Restore
UPDATE products SET deleted_at = NULL WHERE id = ?;
```

## Audit Logging Pattern

Track all changes to critical tables:

```sql
-- Audit log table with 2026 best practices
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(10) NOT NULL, -- INSERT, UPDATE, DELETE
    old_data JSONB,
    new_data JSONB,
    changed_by UUID,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    transaction_id BIGINT DEFAULT txid_current()
);

-- Create index for faster audit queries
CREATE INDEX idx_audit_table_record ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_timestamp ON audit_log(changed_at DESC);

-- Trigger function with improved performance
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        INSERT INTO audit_log (table_name, record_id, action, old_data, changed_by)
        VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD), current_user);
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO audit_log (table_name, record_id, action, old_data, new_data, changed_by)
        VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), current_user);
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO audit_log (table_name, record_id, action, new_data, changed_by)
        VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW), current_user);
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger
CREATE TRIGGER users_audit
AFTER INSERT OR UPDATE OR DELETE ON users
FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
```

## JSONB Flexible Schema

Store variable schema data in JSONB columns:

```sql
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Query JSONB data
SELECT * FROM events
WHERE event_type = 'user_signup'
  AND event_data->>'country' = 'US';

-- Index on JSONB keys (2026: Use GIN for complex queries)
CREATE INDEX idx_events_data ON events USING GIN (event_data);
CREATE INDEX idx_events_country ON events((event_data->>'country'));

-- JSONB containment queries with GIN index
SELECT * FROM events WHERE event_data @> '{"country": "US"}'::jsonb;
```

## Time-Series Data Pattern

Optimized tables for time-series data with PostgreSQL 18 declarative partitioning:

```sql
-- Partitioned table for time-series data
CREATE TABLE metrics (
    id UUID DEFAULT gen_random_uuid(),
    metric_name VARCHAR(100) NOT NULL,
    value DECIMAL,
    timestamp TIMESTAMP NOT NULL,
    tags JSONB,
    PRIMARY KEY (id, timestamp)  -- Include partition key in PK
) PARTITION BY RANGE (timestamp);

-- Create monthly partitions
CREATE TABLE metrics_2024_01 PARTITION OF metrics
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE metrics_2024_02 PARTITION OF metrics
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Automatic partition creation function
CREATE OR REPLACE FUNCTION create_monthly_partition()
RETURNS void AS $$
DECLARE
    partition_date DATE;
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
BEGIN
    partition_date := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month');
    partition_name := 'metrics_' || TO_CHAR(partition_date, 'YYYY_MM');
    start_date := partition_date;
    end_date := partition_date + INTERVAL '1 month';
    
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF metrics FOR VALUES FROM (%L) TO (%L)',
                   partition_name, start_date, end_date);
END;
$$ LANGUAGE plpgsql;

-- Create index on partitioned table (automatically applied to all partitions)
CREATE INDEX idx_metrics_timestamp ON metrics(timestamp DESC);
CREATE INDEX idx_metrics_name ON metrics(metric_name);
```

## 2026: Identity Columns (Recommended over SERIAL)

PostgreSQL 10+ introduced identity columns as the preferred replacement for SERIAL:

```sql
-- 2026 Best Practice: Use GENERATED ALWAYS AS IDENTITY
CREATE TABLE orders (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id UUID NOT NULL,
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_amount DECIMAL(12, 2)
);

-- Benefits over SERIAL:
-- - SQL standard compliant
-- - Better handling of permission changes
-- - Cannot accidentally override with INSERT
```

## 2026: Generated Columns

Store computed values automatically (PostgreSQL 12+):

```sql
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    tax_rate DECIMAL(5, 2) DEFAULT 0.20,
    -- Computed column
    price_with_tax DECIMAL(10, 2) GENERATED ALWAYS AS (
        price * (1 + tax_rate)
    ) STORED
);

-- Index on generated columns is supported
CREATE INDEX idx_products_price_with_tax ON products(price_with_tax);
```

## Normalization Patterns

### Staging Table Pattern

Use staging tables for ETL processes:

```sql
-- Raw data landing zone
CREATE TABLE staging_orders (
    id SERIAL PRIMARY KEY,
    raw_data JSONB,
    processed BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Production table
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id),
    order_date TIMESTAMP,
    total_amount DECIMAL,
    -- ...
);

-- ETL process
INSERT INTO orders (id, customer_id, order_date, total_amount)
SELECT 
    (raw_data->>'id')::UUID,
    (raw_data->>'customer_id')::UUID,
    (raw_data->>'order_date')::TIMESTAMP,
    (raw_data->>'total')::DECIMAL
FROM staging_orders
WHERE NOT processed AND error_message IS NULL;
```

## 2026: NULL Handling with NULLS NOT DISTINCT

PostgreSQL 15+ allows unique indexes to treat NULL as non-distinct:

```sql
-- Unique constraint where NULL values are considered equal
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255),
    employee_number INTEGER,
    UNIQUE NULLS NOT DISTINCT (email)  -- Only one NULL email allowed
);
```

## Best Practices 2026

1. **Use UUIDs for Primary Keys**: Better for distributed systems, use `gen_random_uuid()`
2. **Use Identity Columns**: Replace SERIAL with `GENERATED ALWAYS AS IDENTITY`
3. **Add Created/Updated Timestamps**: Essential for debugging and auditing
4. **Use Appropriate Data Types**: Smaller is faster; consider DOMAIN types
5. **Index Foreign Keys**: Always index columns used in JOINs
6. **Plan for Growth**: Consider partitioning early for time-series data
7. **Document Schema**: Keep schema documentation current
8. **Use Constraints**: Let the database enforce data integrity
9. **Partition Pruning**: Ensure `enable_partition_pruning = on` (default)
10. **Use GIN for JSONB**: For complex JSONB queries, use GIN indexes
