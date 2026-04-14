# Query Optimization

Database performance tuning guide. Updated for PostgreSQL 18 (2026).

## Overview

This guide covers techniques for optimizing database query performance based on the latest PostgreSQL 18 documentation and best practices.

## Indexing Strategies

### B-Tree Indexes

Standard index type for most queries:

```sql
-- Single column index
CREATE INDEX idx_users_email ON users(email);

-- Multi-column (composite) index
CREATE INDEX idx_orders_customer_date ON orders(customer_id, order_date);

-- Partial index (filtered)
CREATE INDEX idx_active_users ON users(email) WHERE status = 'active';

-- Expression index
CREATE INDEX idx_users_lower_email ON users(LOWER(email));

-- 2026: Include columns for index-only scans
CREATE INDEX idx_orders_customer_date_include ON orders(customer_id, order_date)
INCLUDE (total_amount, status);
```

### Index Usage Guidelines

**Create indexes for:**
- Columns in WHERE clauses
- Foreign key columns
- JOIN conditions
- ORDER BY columns
- Columns with high selectivity

**Avoid indexes on:**
- Low cardinality columns (boolean, enum with few values)
- Small tables
- Frequently updated columns
- Columns rarely used in queries

### Analyzing Index Usage

```sql
-- Check index usage statistics
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes 
ORDER BY idx_scan DESC;

-- Find unused indexes (candidates for removal)
SELECT schemaname, tablename, indexname 
FROM pg_stat_user_indexes 
WHERE idx_scan = 0;

-- 2026: Check index-only scan usage
SELECT indexrelname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public';
```

## Query Writing Best Practices

### Select Only Needed Columns

```sql
-- Bad: SELECT *
SELECT * FROM users WHERE status = 'active';

-- Good: Select specific columns
SELECT id, email, name FROM users WHERE status = 'active';
```

### Use LIMIT for Large Result Sets

```sql
-- Bad: Unbounded query
SELECT * FROM logs ORDER BY created_at DESC;

-- Good: Paginated query with keyset pagination (2026 best practice)
SELECT * FROM logs 
WHERE created_at < '2024-01-01'
ORDER BY created_at DESC 
LIMIT 100;

-- Better than OFFSET for large tables
```

### Avoid Functions on Indexed Columns

```sql
-- Bad: Function prevents index use
SELECT * FROM users WHERE LOWER(email) = 'user@example.com';

-- Good: Use expression index or compare directly
SELECT * FROM users WHERE email = 'user@example.com';
-- Or use the expression index: LOWER(email)
```

### Use EXISTS vs IN for Subqueries

```sql
-- Often faster for large datasets
SELECT * FROM customers c
WHERE EXISTS (
    SELECT 1 FROM orders o 
    WHERE o.customer_id = c.id
);

-- Alternative: Use JOIN with DISTINCT
SELECT DISTINCT c.* 
FROM customers c
JOIN orders o ON o.customer_id = c.id;
```

## Query Plan Analysis

### EXPLAIN and EXPLAIN ANALYZE

```sql
-- View query plan
EXPLAIN SELECT * FROM users WHERE email = 'test@example.com';

-- Execute and show actual timings
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT * FROM users WHERE email = 'test@example.com';

-- 2026: Use settings for detailed stats
EXPLAIN (ANALYZE, BUFFERS, WAL, SETTINGS, FORMAT JSON)
SELECT * FROM large_table WHERE condition = 'value';
```

### Understanding Query Plans

Key metrics to watch:
- **Seq Scan**: Full table scan (bad for large tables)
- **Index Scan**: Uses index (good)
- **Index Only Scan**: Reads only index, no heap access (best)
- **Bitmap Heap Scan**: Uses bitmap index
- **Nested Loop**: Row-by-row join
- **Hash Join**: Build hash table for join
- **Merge Join**: Sort and merge

### Cost Estimates

```
Seq Scan on users  (cost=0.00..35.50 rows=2550 width=4)
                     |      |         |       |
                     |      |         |       +-- Row width (bytes)
                     |      |         +---------- Estimated rows
                     |      +-------------------- Total cost
                     +--------------------------- Startup cost
```

## 2026 Parallel Query Optimization

PostgreSQL 18 improves parallel query execution:

```sql
-- Check parallel workers usage
EXPLAIN (ANALYZE, VERBOSE)
SELECT COUNT(*) FROM large_table WHERE condition = 'value';

-- Increase parallelism for a table
ALTER TABLE large_table SET (parallel_workers = 4);

-- Control at session level
SET max_parallel_workers_per_gather = 4;
SET parallel_tuple_cost = 0.01;
SET parallel_setup_cost = 100;
```

## Connection Pooling

### Why Pool Connections?

- Connection establishment is expensive
- Limits concurrent connections
- Prevents resource exhaustion

### PgBouncer Configuration (2026)

```ini
[databases]
mydb = host=localhost port=5432 dbname=mydb

[pgbouncer]
listen_port = 6432
listen_addr = 127.0.0.1
auth_type = scram-sha-256  ; 2026: Use SCRAM not MD5
auth_file = /etc/pgbouncer/userlist.txt

# Pool settings
pool_mode = transaction
max_client_conn = 10000
default_pool_size = 20
min_pool_size = 5
reserve_pool_size = 5
reserve_pool_timeout = 3

# 2026: Query timeout settings
query_timeout = 0
query_wait_timeout = 120
client_idle_timeout = 0
```

## Partitioning for Performance

### When to Partition

- Table size > 100GB
- Time-series data
- Archival requirements
- Parallel query benefits

### Range Partitioning

```sql
CREATE TABLE events (
    id UUID DEFAULT gen_random_uuid(),
    event_type VARCHAR(100),
    data JSONB,
    created_at TIMESTAMP
) PARTITION BY RANGE (created_at);

CREATE TABLE events_2024_q1 PARTITION OF events
    FOR VALUES FROM ('2024-01-01') TO ('2024-04-01');

CREATE TABLE events_2024_q2 PARTITION OF events
    FOR VALUES FROM ('2024-04-01') TO ('2024-07-01');

-- Create index on parent - propagates to partitions
CREATE INDEX idx_events_created ON events(created_at DESC);
```

### Partition Pruning

```sql
-- Query only touches relevant partitions
EXPLAIN SELECT * FROM events 
WHERE created_at >= '2024-01-01' 
  AND created_at < '2024-02-01';
-- Should show: Partition Ref: events_2024_q1

-- Enable runtime partition pruning
SET enable_partition_pruning = on;
```

## Materialized Views

### When to Use

- Expensive aggregations
- Report queries
- Data that changes infrequently

```sql
-- Create materialized view
CREATE MATERIALIZED VIEW daily_stats AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) as event_count,
    COUNT(DISTINCT user_id) as unique_users
FROM events
GROUP BY DATE(created_at);

-- Create index on materialized view
CREATE INDEX idx_daily_stats_date ON daily_stats(date);

-- Refresh when needed
REFRESH MATERIALIZED VIEW daily_stats;

-- Concurrent refresh (doesn't block reads)
REFRESH MATERIALIZED VIEW CONCURRENTLY daily_stats;
```

## 2026: Incremental View Maintenance

PostgreSQL 18+ supports auto-refresh for materialized views:

```sql
-- Create with auto-refresh (if extension enabled)
CREATE EXTENSION IF NOT EXISTS pg_ivm;

-- Create incrementally maintainable view
CREATE INCREMENTAL MATERIALIZED VIEW user_stats AS
SELECT user_id, COUNT(*) as order_count
FROM orders
GROUP BY user_id;
-- Auto-updates on base table changes
```

## Caching Strategies

### Application-Level Caching

```python
import redis
from functools import wraps

cache = redis.Redis(host='localhost', port=6379)

def cached(ttl=300):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            key = f"{func.__name__}:{str(args)}:{str(kwargs)}"
            cached_value = cache.get(key)
            if cached_value:
                return cached_value
            result = func(*args, **kwargs)
            cache.setex(key, ttl, result)
            return result
        return wrapper
    return decorator

@cached(ttl=600)
def get_user_by_email(email):
    return db.query("SELECT * FROM users WHERE email = %s", (email,))
```

### 2026: Result Cache in PostgreSQL

PostgreSQL 18 introduces query result caching:

```sql
-- Enable result caching for frequently-run queries
ALTER SYSTEM SET enable_result_cache = on;

-- Query hint to use result cache (if supported)
/*+ CACHE_RESULT */ SELECT * FROM static_lookup_table;
```

## Monitoring Slow Queries

### PostgreSQL Log Configuration

```sql
-- Log slow queries (> 1 second)
ALTER SYSTEM SET log_min_duration_statement = 1000;
SELECT pg_reload_conf();

-- 2026: Use JSON log format
ALTER SYSTEM SET log_line_prefix = '';
ALTER SYSTEM SET log_destination = 'jsonlog';
```

### pg_stat_statements

```sql
-- Enable extension
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Find slowest queries
SELECT 
    query,
    calls,
    mean_exec_time,
    total_exec_time,
    rows,
    shared_blks_hit,
    shared_blks_read
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Reset stats
SELECT pg_stat_statements_reset();
```

### 2026: pg_stat_io

Monitor I/O statistics (PostgreSQL 16+):

```sql
-- Check I/O stats by backend type
SELECT 
    backend_type,
    object,
    context,
    reads,
    read_time,
    writes,
    write_time
FROM pg_stat_io
ORDER BY reads DESC;
```

## Vacuum and Autovacuum Tuning

```sql
-- Check table bloat
SELECT schemaname, tablename, n_tup_ins, n_tup_upd, n_tup_del, n_live_tup, n_dead_tup
FROM pg_stat_user_tables
WHERE n_dead_tup > 10000
ORDER BY n_dead_tup DESC;

-- Manual vacuum with analysis
VACUUM (VERBOSE, ANALYZE) users;

-- 2026: Vacuum with specific workers
VACUUM (PARALLEL 4, ANALYZE) large_table;
```

## Best Practices 2026

1. **Analyze Tables Regularly**: `ANALYZE tablename;`
2. **Use Appropriate Data Types**: Smaller is faster
3. **Batch Inserts**: Use COPY or multi-row INSERT
4. **Vacuum Regularly**: Prevent bloat
5. **Monitor Cache Hit Ratio**: Should be > 99%
6. **Avoid N+1 Queries**: Use JOINs or IN clauses
7. **Use Connection Pooling**: PgBouncer or similar
8. **Leverage Parallel Queries**: Set `parallel_workers` on large tables
9. **Use Index-Only Scans**: Include commonly queried columns in indexes
10. **Monitor I/O Stats**: Use `pg_stat_io` in PostgreSQL 16+
