# OWASP Guidelines

## OWASP Top 10 (2021)

### A01: Broken Access Control
- Deny by default - all requests should fail unless explicitly allowed
- Implement once, reuse everywhere - use centralized access control
- Minimize CORS usage - restrictive origins only
- Rate limit API access to reduce brute force attacks

### A02: Cryptographic Failures
- Encrypt data in transit (TLS 1.2+) and at rest
- Use strong, industry-standard algorithms (AES-256, RSA-4096)
- Never roll your own crypto - use established libraries
- Properly manage keys with secure key management systems

### A03: Injection
- Use parameterized queries for database access
- Validate and sanitize all user input
- Use allowlists for input validation
- Escape special characters in context-specific ways

### A04: Insecure Design
- Adopt secure design patterns and principles
- Use threat modeling for critical features
- Integrate security language into user stories
- Limit resource consumption per user/request

### A05: Security Misconfiguration
- Minimal platform - remove unnecessary features
- Patch and upgrade in timely manner
- Disable verbose error messages in production
- Configure security headers properly

### A06: Vulnerable and Outdated Components
- Maintain inventory of all components and versions
- Remove unused dependencies
- Monitor for CVEs affecting your stack
- Have a patch management process

### A07: Identification and Authentication Failures
- Implement multi-factor authentication
- Use strong session management
- Don't use default credentials
- Implement proper password recovery flows

### A08: Software and Data Integrity Failures
- Verify dependencies and use trusted repositories
- Implement digital signatures for critical data
- Ensure CI/CD pipelines have proper integrity checks
- Don't deserialize untrusted data

### A09: Security Logging and Monitoring Failures
- Ensure all login, access control, and input validation failures are logged
- Logs should be in a format suitable for monitoring
- Ensure logs are protected from tampering
- Use real-time alerting for suspicious activities

### A10: Server-Side Request Forgery (SSRF)
- Sanitize and validate all client-supplied input data
- Use allowlists for URLs and IP addresses
- Disable unused URL schemas
- Enforce network segmentation

## Secure Coding Practices

### Input Validation
- Validate all input on the server side
- Use type, length, format, and range constraints
- Reject invalid input rather than sanitizing
- Use allowlists, not denylists

### Output Encoding
- Encode all output appropriate for the context
- Use framework auto-escaping when available
- Be aware of different encoding contexts (HTML, JavaScript, URL, CSS)

### Authentication
- Implement secure password storage (bcrypt, Argon2)
- Use secure session management
- Implement account lockout after failed attempts
- Support MFA where possible

### Error Handling
- Don't expose stack traces or system details in production
- Use generic error messages for users
- Log detailed errors securely
- Handle all exceptions gracefully
