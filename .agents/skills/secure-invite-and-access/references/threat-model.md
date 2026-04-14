# Threat Model Guide

## Authentication Threat Modeling

### STRIDE Analysis

| Threat | Example | Mitigation |
|--------|---------|------------|
| **Spoofing** | Fake user identity | Strong auth, MFA, session binding |
| **Tampering** | Modified request | Request signing, CSRF tokens |
| **Repudiation** | "I didn't do that" | Audit logs, non-repudiation |
| **Information Disclosure** | Data leak | Encryption, access control |
| **Denial of Service** | Lock accounts | Rate limiting, circuit breakers |
| **Elevation of Privilege** | Admin access | RBAC, principle of least privilege |

### Session Security
- Bind sessions to IP/user-agent fingerprint
- Rotate on privilege change
- Invalidate on logout/password change
- Set appropriate timeout (absolute + idle)

### Token Security
- Sign with strong algorithm (HMAC-SHA256+)
- Include expiry (exp claim for JWT)
- Validate signature server-side
- Never trust client-stored tokens

### API Security
- Rate limit per user/IP
- Validate all inputs with schema validation
- Return generic error messages
- Log access attempts with trace IDs
