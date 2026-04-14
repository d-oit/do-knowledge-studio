# OpenAPI 3.0 Examples

## Basic API Structure

```yaml
openapi: 3.0.3
info:
  title: Example API
  description: A sample API demonstrating OpenAPI 3.0 features
  version: 1.0.0
  contact:
    name: API Support
    email: api@example.com

servers:
  - url: https://api.example.com/v1
    description: Production server
  - url: https://staging-api.example.com/v1
    description: Staging server

paths:
  /users:
    get:
      summary: List users
      description: Returns a paginated list of users
      parameters:
        - name: page
          in: query
          description: Page number
          schema:
            type: integer
            default: 1
        - name: per_page
          in: query
          description: Items per page
          schema:
            type: integer
            default: 20
            maximum: 100
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserList'
    
    post:
      summary: Create user
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UserCreate'
      responses:
        '201':
          description: Created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '400':
          description: Validation error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

  /users/{id}:
    parameters:
      - name: id
        in: path
        required: true
        schema:
          type: string
    
    get:
      summary: Get user by ID
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '404':
          description: User not found
    
    put:
      summary: Update user (full)
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UserUpdate'
      responses:
        '200':
          description: Updated
        '404':
          description: User not found
    
    patch:
      summary: Partial update
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UserPatch'
      responses:
        '200':
          description: Updated
    
    delete:
      summary: Delete user
      responses:
        '204':
          description: Deleted
        '404':
          description: User not found

components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: string
          example: "user-123"
        email:
          type: string
          format: email
          example: "user@example.com"
        name:
          type: string
          example: "John Doe"
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time
      required:
        - id
        - email
        - name
    
    UserCreate:
      type: object
      properties:
        email:
          type: string
          format: email
        name:
          type: string
        password:
          type: string
          format: password
          minLength: 8
      required:
        - email
        - name
        - password
    
    UserUpdate:
      type: object
      properties:
        email:
          type: string
          format: email
        name:
          type: string
        password:
          type: string
          format: password
          minLength: 8
      required:
        - email
        - name
    
    UserPatch:
      type: object
      properties:
        email:
          type: string
          format: email
        name:
          type: string
        password:
          type: string
          format: password
          minLength: 8
    
    UserList:
      type: object
      properties:
        data:
          type: array
          items:
            $ref: '#/components/schemas/User'
        meta:
          type: object
          properties:
            page:
              type: integer
            per_page:
              type: integer
            total:
              type: integer
    
    Error:
      type: object
      properties:
        code:
          type: string
        message:
          type: string
        details:
          type: array
          items:
            type: object
            properties:
              field:
                type: string
              message:
                type: string
  
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
    
    apiKey:
      type: apiKey
      in: header
      name: X-API-Key

security:
  - bearerAuth: []
```

## Reusable Parameters

```yaml
components:
  parameters:
    PageParam:
      name: page
      in: query
      schema:
        type: integer
        default: 1
    
    PerPageParam:
      name: per_page
      in: query
      schema:
        type: integer
        default: 20

paths:
  /items:
    get:
      parameters:
        - $ref: '#/components/parameters/PageParam'
        - $ref: '#/components/parameters/PerPageParam'
```

## Response Examples

```yaml
paths:
  /users:
    get:
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserList'
              examples:
                sample:
                  value:
                    data:
                      - id: "user-1"
                        email: "alice@example.com"
                        name: "Alice"
                    meta:
                      page: 1
                      per_page: 20
                      total: 1
```
