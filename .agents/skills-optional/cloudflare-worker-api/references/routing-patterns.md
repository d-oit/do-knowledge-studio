# Cloudflare Worker Routing Patterns

Common routing patterns for Workers API.

## Route Structure
- File-based routing from `src/routes/`
- Each file exports a handler function
- Middleware applied at route level

## Auth Middleware
- Session validation before protected routes
- Generic 401 responses (no info leakage)
- Trace ID propagation to all handlers
