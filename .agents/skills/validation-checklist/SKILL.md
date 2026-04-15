---
name: validation-checklist
description: Maintain high data quality and schema adherence within the knowledge studio.
version: 0.1.0
---
# Skill: validation-checklist

Maintain high data quality and schema adherence.

## Guidelines
1.  **Zod Always**: Every API or DB boundary must be guarded by a Zod schema.
2.  **No Silent Errors**: Use `AppError` and `logger.error` for every validation failure.
3.  **Sanitization**: Sanitize all Markdown and HTML output to prevent XSS.
4.  **Integrity**: Ensure referential integrity (e.g., no Links to non-existent Entities).
