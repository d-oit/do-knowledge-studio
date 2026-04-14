# REST API Design Guidelines

## Resource Naming

### Use Nouns, Not Verbs
```
GET    /users          (not /getUsers)
POST   /users          (not /createUser)
PUT    /users/123      (not /updateUser/123)
DELETE /users/123      (not /deleteUser/123)
```

### Plural vs Singular
- Use plural for collection endpoints: `/orders`
- Use singular sparingly for singletons: `/me`, `/status`

### Nested Resources
```
GET    /users/123/orders      - Get user's orders
POST   /users/123/orders      - Create order for user
GET    /users/123/orders/456  - Get specific order
```

### Limit Nesting Depth
- Maximum 2-3 levels deep
- Use HATEOAS links for deeper relationships

## HTTP Methods

| Method | Idempotent | Safe | Usage |
|--------|------------|------|-------|
| GET    | Yes        | Yes  | Retrieve resource |
| POST   | No         | No   | Create resource |
| PUT    | Yes        | No   | Full update |
| PATCH  | No         | No   | Partial update |
| DELETE | Yes        | No   | Remove resource |
| HEAD   | Yes        | Yes  | Check existence |
| OPTIONS| Yes        | Yes  | Get capabilities |

## Status Codes

### Success (2xx)
- **200 OK** - Standard success response
- **201 Created** - Resource created successfully
- **204 No Content** - Success with empty body

### Client Error (4xx)
- **400 Bad Request** - Malformed request
- **401 Unauthorized** - Authentication required
- **403 Forbidden** - Insufficient permissions
- **404 Not Found** - Resource doesn't exist
- **409 Conflict** - Resource conflict (duplicate)
- **422 Unprocessable** - Validation failed
- **429 Too Many Requests** - Rate limit exceeded

### Server Error (5xx)
- **500 Internal Error** - Unexpected server error
- **502 Bad Gateway** - Upstream error
- **503 Unavailable** - Service temporarily down

## Request/Response Formats

### Content Negotiation
```http
Accept: application/json
Content-Type: application/json
```

### Date/Time Format
- Use ISO 8601: `2024-01-15T10:30:00Z`
- Include timezone or use UTC

### Pagination Patterns

#### Offset-Based
```json
{
  "data": [...],
  "meta": {
    "page": 2,
    "per_page": 20,
    "total": 150,
    "total_pages": 8
  }
}
```

#### Cursor-Based
```json
{
  "data": [...],
  "meta": {
    "next_cursor": "abc123",
    "has_more": true
  }
}
```

### Filtering
```
GET /users?status=active&role=admin
GET /orders?created_after=2024-01-01
GET /products?category=electronics&price_lt=100
```

### Sorting
```
GET /users?sort=created_at
GET /users?sort=-created_at (descending)
GET /users?sort=name,created_at (multiple fields)
```

## Error Response Format
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "target": "user_input",
    "details": [
      {
        "code": "INVALID_FORMAT",
        "message": "Email format is invalid",
        "target": "email"
      }
    ]
  }
}
```

## Idempotency

For non-idempotent operations (POST, PATCH), support idempotency keys:
```http
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
```

## Caching

### Cache Headers
```http
ETag: "33a64df5"
Cache-Control: max-age=3600
Last-Modified: Wed, 21 Oct 2024 07:28:00 GMT
```

### Conditional Requests
```http
If-None-Match: "33a64df5"
If-Modified-Since: Wed, 21 Oct 2024 07:28:00 GMT
```
