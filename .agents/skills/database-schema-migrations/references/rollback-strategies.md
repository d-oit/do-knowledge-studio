# Rollback Strategies

Safe rollback strategies for database migrations.

## Forward Rollback
- Prefer forward migrations over rollbacks
- Add new columns as nullable, backfill, then constrain

## Backward Rollback
- Drop indexes before tables
- Remove columns only after code no longer references them
