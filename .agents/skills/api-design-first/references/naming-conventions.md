# Naming Conventions

## General Principles

- Be consistent across the entire API
- Use clear, descriptive names
- Avoid abbreviations unless universally understood
- Use American English spelling

## Resource Names

### Plural Nouns
```
/users        (not /user)
/orders       (not /order)
/products     (not /product)
```

### Compound Words
- Use kebab-case (hyphen-separated lowercase)
```
/order-items
/user-preferences
/product-categories
```

### Avoid Verbs in Paths
```
# Bad
/createUser
/getOrders
/updateProduct

# Good
POST   /users
GET    /orders
PUT    /products/{id}
```

## Field Names

### JSON Property Names
- Use camelCase for JavaScript/TypeScript APIs
- Use snake_case for Python/Ruby APIs
- Be consistent within your ecosystem

```json
// camelCase (JavaScript)
{
  "firstName": "John",
  "lastName": "Doe",
  "createdAt": "2024-01-15T10:30:00Z"
}

// snake_case (Python)
{
  "first_name": "John",
  "last_name": "Doe",
  "created_at": "2024-01-15T10:30:00Z"
}
```

### Boolean Fields
Use positive, boolean-sounding names:
```
isActive      (not status)
hasPermission (not permissionFlag)
isVerified    (not verifiedStatus)
canEdit       (not editAllowed)
```

### Date/Time Fields
Include the data type in the name:
```
createdAt   / created_at
updatedAt   / updated_at
deletedAt   / deleted_at (for soft deletes)
expiresAt   / expires_at
publishedAt / published_at
```

### Relationship Fields
```
// Singular relationship
authorId    / author_id

// Plural relationship
tagIds      / tag_ids
memberIds   / member_ids
```

## Query Parameters

### Filtering
```
?status=active
?role=admin&department=sales
?createdAfter=2024-01-01
```

### Operators
```
?age_gt=18       (greater than)
?price_lt=100    (less than)
?date_gte=2024-01-01 (greater than or equal)
?score_lte=100   (less than or equal)
?name_like=john (substring match)
?tags_in=js,ts,python (in array)
```

### Sorting
```
?sort=created_at           (ascending)
?sort=-created_at          (descending)
?sort=name,-created_at     (multiple fields)
```

## Enums

Use UPPER_SNAKE_CASE for enum values:
```json
{
  "status": "PENDING",
  "priority": "HIGH"
}
```

Or use lowercase if more readable:
```json
{
  "status": "pending",
  "type": "subscription"
}
```

## Error Codes

Use UPPER_SNAKE_CASE:
```
VALIDATION_ERROR
AUTHENTICATION_FAILED
RESOURCE_NOT_FOUND
RATE_LIMIT_EXCEEDED
INSUFFICIENT_PERMISSIONS
```

## URL Patterns

### Versioning
```
/v1/users
/api/v2/products
```

### Actions on Resources
For actions that don't fit CRUD:
```
POST /users/{id}/activate
POST /orders/{id}/cancel
POST /sessions/{id}/refresh
```

### Search
```
GET /search?q=query&category=products
POST /search (for complex queries)
```

## Consistency Checklist

- [ ] All resources use plural nouns
- [ ] Case convention is consistent (kebab-case for URLs)
- [ ] Field naming matches target ecosystem
- [ ] Date fields have consistent suffixes
- [ ] Boolean fields are positive sounding
- [ ] Error codes follow consistent pattern
- [ ] Query parameter names are consistent
