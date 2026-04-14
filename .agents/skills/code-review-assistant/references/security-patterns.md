# Security Review Patterns

Security review patterns and checks for the Code Review Assistant skill.

## Overview

This guide documents common security issues to detect during code review and patterns for identifying them.

## Security Check Categories

### 1. Secrets and Credentials

**Patterns to Detect:**

```python
# Hardcoded passwords
BAD:  password = "secret123"
GOOD: password = os.environ['DB_PASSWORD']

# API keys in code
BAD:  api_key = "sk-abc123xyz"
GOOD: api_key = config.get_api_key()

# Private keys
BAD:  private_key = """-----BEGIN RSA PRIVATE KEY-----
GOOD: private_key = load_from_secure_storage()
```

**Detection Regex:**
```python
HARDCODED_SECRET_PATTERNS = [
    r'(password|passwd|pwd)\s*=\s*["\'][^"\']+',
    r'(api[_-]?key|apikey)\s*=\s*["\'][^"\']+',
    r'(secret|token)\s*=\s*["\'][^"\']+',
    r'-----BEGIN (RSA |DSA |EC )?PRIVATE KEY-----',
]
```

### 2. SQL Injection

**Vulnerable Patterns:**

```python
# BAD: String concatenation
query = f"SELECT * FROM users WHERE id = {user_id}"
cursor.execute(query)

# GOOD: Parameterized queries
query = "SELECT * FROM users WHERE id = ?"
cursor.execute(query, (user_id,))
```

**Detection Patterns:**
```python
SQL_INJECTION_PATTERNS = [
    r'execute\s*\([^)]*%\s*',  # String formatting in execute
    r'execute\s*\([^)]*\+',     # String concatenation in execute
    r'\.format\s*\([^)]*\)\s*\.\s*execute',
    r'f["\'].*\{.*\}.*["\'].*execute',
]
```

### 3. Command Injection

**Vulnerable Patterns:**

```python
# BAD: User input in system commands
os.system(f"ls {user_input}")
subprocess.call("grep " + user_input, shell=True)

# GOOD: Use argument lists, no shell
subprocess.run(['grep', pattern, file_path])
subprocess.run(['ls', directory], shell=False)
```

### 4. Path Traversal

**Vulnerable Patterns:**

```python
# BAD: User input in file paths
with open(f"/var/www/{filename}") as f:
    content = f.read()

# GOOD: Sanitize and validate paths
safe_path = os.path.join(base_dir, os.path.basename(filename))
if not safe_path.startswith(base_dir):
    raise ValueError("Invalid path")
```

### 5. Unsafe Deserialization

**Dangerous Patterns:**

```python
# BAD: pickle with untrusted data
data = pickle.loads(untrusted_input)

# GOOD: Use safe formats like JSON
import json
data = json.loads(untrusted_input)
```

**High-Risk Functions:**
- `pickle.loads()`
- `yaml.load()` (without SafeLoader)
- `eval()` / `exec()`
- `marshal.loads()`

### 6. Insecure Direct Object References (IDOR)

**Review Checklist:**
- [ ] Are all API endpoints checking user permissions?
- [ ] Can users access other users' data by changing IDs?
- [ ] Is there proper authorization before data access?

**Example Issue:**
```python
# BAD: No permission check
@app.route('/api/documents/<id>')
def get_document(id):
    return Document.query.get(id)  # Any user can access any document

# GOOD: Authorization check
@app.route('/api/documents/<id>')
@login_required
def get_document(id):
    doc = Document.query.get_or_404(id)
    if doc.owner_id != current_user.id:
        abort(403)
    return doc
```

### 7. Authentication and Session Issues

**Patterns to Check:**

```python
# BAD: Weak password policy
# No minimum length, no complexity requirements

# GOOD: Enforce strong passwords
validate_password_strength(password)  # min 12 chars, mixed case, numbers

# BAD: No rate limiting on login
@app.route('/login', methods=['POST'])
def login():
    # Can be brute-forced

# GOOD: Rate limiting
@limiter.limit("5 per minute")
@app.route('/login', methods=['POST']])
def login():
    # Protected from brute force
```

### 8. Cross-Site Scripting (XSS)

**Vulnerable Patterns:**

```python
# BAD: Unescaped user input in HTML
html = f"<div>Hello, {username}</div>"

# GOOD: Proper escaping
from html import escape
html = f"<div>Hello, {escape(username)}</div>"

# EVEN BETTER: Use templating with auto-escape
from jinja2 import Template
template = Template("<div>Hello, {{ username }}</div>")
```

### 9. Insecure Cryptography

**Weak Patterns:**

```python
# BAD: Weak hashing
import hashlib
hash = hashlib.md5(password).hexdigest()  # MD5 is broken

# BAD: Hardcoded salt
hash = bcrypt.hashpw(password, b"hardcoded_salt")

# GOOD: Strong hashing with unique salt
hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt())

# BAD: ECB mode encryption
from Crypto.Cipher import AES
cipher = AES.new(key, AES.MODE_ECB)

# GOOD: GCM mode with authentication
cipher = AES.new(key, AES.MODE_GCM)
```

### 10. Logging Sensitive Data

**Dangerous Logging:**

```python
# BAD: Logging sensitive data
logger.info(f"User login: {username}, password: {password}")
logger.debug(f"Credit card: {card_number}")

# GOOD: Sanitize logs
logger.info(f"User login: {username}")  # Never log passwords
logger.debug(f"Payment processed for user: {user_id}")  # Don't log card numbers
```

## Severity Levels

| Level | Description | Examples |
|-------|-------------|----------|
| **CRITICAL** | Immediate security risk | Hardcoded secrets, SQL injection, RCE |
| **HIGH** | Significant risk | Weak crypto, auth bypass, IDOR |
| **MEDIUM** | Moderate concern | Missing rate limiting, verbose errors |
| **LOW** | Minor issue | Outdated dependencies, info disclosure |

## Automated Detection

### Security Check Configuration

```yaml
security_checks:
  secrets:
    enabled: true
    severity: critical
    patterns:
      - password_assignment
      - api_key_exposure
      - private_key_embedded
  
  injection:
    enabled: true
    severity: critical
    patterns:
      - sql_injection
      - command_injection
      - xss_reflected
  
  crypto:
    enabled: true
    severity: high
    patterns:
      - weak_hashing
      - hardcoded_keys
      - insecure_random
```

## Review Comments

### Critical Issue Template

```markdown
🚨 **CRITICAL: Security Issue Detected**

**Issue**: {issue_type} - {description}

**Risk**: {risk_explanation}

**Fix**: {remediation}

**Example**:
```python
# Instead of:
{bad_code}

# Use:
{good_code}
```

**References**:
- OWASP: {owasp_link}
- CWE: {cwe_id}
```

## False Positives

Common false positives to watch for:
- Test data that looks like secrets (in test files)
- Documentation examples (marked with "example" or "dummy")
- Configuration templates with placeholders
- Encrypted values (already protected)

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE Top 25](https://cwe.mitre.org/top25/)
- [GitHub Security Lab](https://securitylab.github.com/)
