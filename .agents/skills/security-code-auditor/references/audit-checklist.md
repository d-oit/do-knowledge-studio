# Security Audit Checklist

## Pre-Audit Preparation

- [ ] Identify the technology stack and frameworks
- [ ] List all entry points (APIs, forms, file uploads)
- [ ] Document authentication and authorization mechanisms
- [ ] Identify sensitive data flows
- [ ] Review existing security documentation

## Code Review Checklist

### Input Validation
- [ ] All user inputs are validated
- [ ] Type casting is used appropriately
- [ ] Length limits are enforced
- [ ] Format validation is applied (regex, schemas)
- [ ] Range checks are implemented for numeric values

### Output Encoding
- [ ] HTML output is properly escaped
- [ ] JavaScript context encoding is applied
- [ ] URL parameters are encoded
- [ ] SQL queries use parameterization

### Authentication
- [ ] Password policies are enforced
- [ ] Session tokens are cryptographically secure
- [ ] Session expiration is implemented
- [ ] Login rate limiting is in place
- [ ] Account lockout mechanisms exist
- [ ] MFA is supported (if required)

### Authorization
- [ ] Access controls are enforced on every endpoint
- [ ] Role-based access control is properly implemented
- [ ] Direct object references are protected
- [ ] Horizontal and vertical privilege escalation is prevented

### Cryptography
- [ ] Strong encryption algorithms are used
- [ ] Keys are properly managed (not hardcoded)
- [ ] Sensitive data is encrypted at rest
- [ ] TLS is enforced for all communications
- [ ] Certificate validation is not disabled

### Session Management
- [ ] Session IDs are random and unpredictable
- [ ] Sessions timeout after inactivity
- [ ] Sessions are invalidated on logout
- [ ] Secure and HttpOnly flags are set on cookies
- [ ] SameSite cookie attribute is configured

### Error Handling
- [ ] Stack traces are not exposed to users
- [ ] Sensitive information is not logged inappropriately
- [ ] Generic error messages are shown to users
- [ ] All errors are properly handled

### File Handling
- [ ] File uploads validate type and size
- [ ] Uploaded files are stored outside web root
- [ ] Path traversal is prevented
- [ ] Executable extensions are restricted

### API Security
- [ ] Rate limiting is implemented
- [ ] API keys/tokens are properly validated
- [ ] CORS is properly configured
- [ ] Content-Type validation is enforced
- [ ] API versioning strategy is in place

### Dependencies
- [ ] All dependencies are up to date
- [ ] Known vulnerabilities (CVEs) are checked
- [ ] Unused dependencies are removed
- [ ] License compliance is verified

## Configuration Review

### Security Headers
- [ ] Content-Security-Policy is configured
- [ ] X-Content-Type-Options: nosniff is set
- [ ] X-Frame-Options or CSP frame-ancestors is set
- [ ] Strict-Transport-Security (HSTS) is enabled
- [ ] Referrer-Policy is configured
- [ ] Permissions-Policy is set

### Environment
- [ ] Debug mode is disabled in production
- [ ] Environment variables are properly secured
- [ ] No hardcoded credentials in configuration
- [ ] Database connections use least privilege
- [ ] Logging levels are appropriate for environment

## Post-Audit

- [ ] Document all findings with severity
- [ ] Create remediation timeline
- [ ] Assign owners for each fix
- [ ] Schedule re-audit after remediation
- [ ] Update security documentation
