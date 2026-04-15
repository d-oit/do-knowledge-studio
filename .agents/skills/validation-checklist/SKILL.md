# Validation Checklist
1. All inputs must pass Zod schema.
2. Return AppError for all failures.
3. No silent errors in DB operations.
