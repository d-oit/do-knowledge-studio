# Response Helpers

Consistent response formatting for Worker APIs.

## Response Format
```ts
{ success: boolean, data?: T, error?: string, traceId: string }
```

## Error Handling
- Zod validation errors → 400
- Auth failures → 401 (generic message)
- Server errors → 500 with trace ID
