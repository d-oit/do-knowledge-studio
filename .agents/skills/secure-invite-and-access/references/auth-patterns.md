# Secure Invite and Access - References

## Auth Patterns

Common authentication and authorization patterns for web applications.

### Session-based Auth
- Use secure cookie flags (HttpOnly, Secure, SameSite)
- Rotate session IDs on login
- Implement session timeout with sliding window

### Token-based Auth (JWT)
- Keep tokens short-lived (15-30 min access tokens)
- Implement refresh token rotation
- Store refresh tokens server-side for revocation

### Password Security
- Use Argon2id or bcrypt for hashing
- Enforce minimum complexity (8+ chars, no common passwords)
- Implement rate limiting on login attempts

### Signed URLs
- Include expiry timestamp (max 15 min TTL)
- Sign with HMAC-SHA256
- Include trace ID for audit trail

## Threat Modeling

### Common Attack Vectors
- Credential stuffing (mitigate: rate limiting, CAPTCHA)
- Session hijacking (mitigate: secure cookies, rotation)
- Enumeration attacks (mitigate: generic error messages)
- Replay attacks (mitigate: nonce, short TTL)

### Audit Logging
- Log all auth events (login, logout, grant, revoke)
- Include actor ID, trace ID, timestamp, outcome
- Never log sensitive data (passwords, tokens)
