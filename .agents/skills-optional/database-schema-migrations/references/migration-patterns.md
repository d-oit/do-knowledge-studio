# Database Migration Patterns

Common migration patterns for SQL databases.

## Idempotent Migrations
- Use `CREATE TABLE IF NOT EXISTS`
- Use `CREATE INDEX IF NOT EXISTS`
- Check column existence before adding

## Naming
- `YYYYMMDD_description.sql`
- One concern per migration file
