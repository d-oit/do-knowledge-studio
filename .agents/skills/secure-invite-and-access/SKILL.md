---
version: "1.0.0"
name: secure-invite-and-access
description: "Implement access control, authentication, and authorization: auth endpoints, sessions, signed URLs."
category: workflow
---

# Secure Invite and Access

Implement access-control rules (authentication, authorization, sessions, audit logging) for any web application.

## When to run
- Working on authentication, authorization, or session management.
- Implementing role-based access control (RBAC) or permission grants.
- Updating signed URL issuance/verification or audit logging.
- Investigating auth-related bugs or observability gaps.

## Workflow
1. **Define auth requirements** -- confirm auth model (sessions, JWT, OAuth), password hashing, TTL expectations.
2. **Threat model** -- identify enumeration risks, replay attacks, session leakage vectors.
3. **Implement** -- secure password hashing (Argon2id/bcrypt), session issuing/refresh/revoke, signed URLs with TTL, trace ID logging.
4. **Audit** -- log auth events with actor + trace ID. Return generic access-denied errors; never leak whether accounts exist.
5. **Tests** -- add coverage for password validation, session expiry, signature validation, revocation flows.

## Checklist
- [ ] All auth endpoints validate payloads with schema validation + capability checks.
- [ ] Sessions + signed tokens include expiry metadata and trace IDs.
- [ ] Logout/refresh revoke existing tokens.
- [ ] Audit rows created for create/update/revoke/grant usage.
- [ ] Rate limiting or abuse guard documented (even if stubbed).
- [ ] Never expose whether an email/username exists in error messages.

## References
- `references/auth-patterns.md` - Common authentication patterns
- `references/threat-model.md` - Auth threat modeling guide
