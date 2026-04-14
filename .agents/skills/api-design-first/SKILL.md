---
name: api-design-first
description: Design and document RESTful APIs using design-first principles with OpenAPI specifications. Use when users ask to 'design an API', 'create API spec', 'REST API', 'OpenAPI', 'Swagger', or 'API documentation'. Trigger on API design tasks, endpoint planning, request/response modeling, or API versioning discussions.
version: "1.0"
template_version: "0.2"
license: MIT
---

# API Design First

Design RESTful APIs using design-first principles with comprehensive OpenAPI 3.0 specifications.

## Design Principles

### 1. API-First Mindset
- Design the API contract before implementation
- Use OpenAPI 3.0 as the source of truth
- Generate code from specifications, not vice versa

### 2. RESTful Design
- Use nouns for resources (not verbs)
- Leverage HTTP methods semantically
- Implement proper status codes
- Support filtering, pagination, and sorting

### 3. Consistency
- Follow naming conventions throughout
- Use consistent request/response formats
- Maintain backward compatibility with versioning

## Resource Naming

```
GET    /users              # List users
GET    /users/{id}         # Get specific user
POST   /users              # Create user
PUT    /users/{id}         # Update user (full)
PATCH  /users/{id}         # Partial update
DELETE /users/{id}         # Delete user
GET    /users/{id}/orders  # Sub-resource collection
```

## HTTP Status Codes

| Code | Usage |
|------|-------|
| 200 | Successful GET, PUT, PATCH |
| 201 | Successful POST (resource created) |
| 204 | Successful DELETE |
| 400 | Bad request (validation error) |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Resource not found |
| 409 | Conflict (duplicate, etc.) |
| 422 | Unprocessable entity |
| 429 | Rate limited |
| 500 | Server error |

## Request/Response Patterns

### Pagination
```json
{
  "data": [...],
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 150,
    "total_pages": 8
  },
  "links": {
    "self": "/users?page=1",
    "next": "/users?page=2",
    "last": "/users?page=8"
  }
}
```

### Error Response
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      { "field": "email", "message": "Invalid email format" }
    ]
  }
}
```

## OpenAPI Structure

```yaml
openapi: 3.0.3
info:
  title: Example API
  version: 1.0.0
paths:
  /users:
    get:
      summary: List users
      parameters:
        - name: page
          in: query
          schema:
            type: integer
      responses:
        '200':
          description: Success
```

## Versioning Strategies

1. **URL Path**: `/v1/users`, `/v2/users`
2. **Header**: `Accept: application/vnd.api+json;version=2`
3. **Query Param**: `/users?api-version=2`

## References

- `references/rest-guidelines.md` - Comprehensive REST design guidelines
- `references/openapi-examples.md` - Complete OpenAPI 3.0 specification examples
- `references/naming-conventions.md` - Resource and field naming standards
