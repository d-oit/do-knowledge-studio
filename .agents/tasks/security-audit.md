# Security Audit Task

You are performing a comprehensive security audit of this codebase. Follow these steps systematically.

## Phase 0 — Bootstrap

1. Read `AGENTS.md` and internalize all rules, especially security-related ones.
2. Load the `security-code-auditor` and `privacy-first` skills.
3. Create audit branch:
   ```bash
   git checkout -b security/audit-YYYY-MM-DD
   ```

## Phase 1 — Dependency Scan

1. Run npm/pnpm audit:
   ```bash
   pnpm audit
   pnpm audit --json > plans/security-audit-deps.json
   ```
2. Check for supply chain attacks:
   ```bash
   pnpm audit --audit-level high
   ```
3. Review any packages with known vulnerabilities.
4. Document findings in `plans/security-audit.md`.

## Phase 2 — Code-Level Security Review

1. **Secrets & Credentials**: Scan for hardcoded keys, tokens, passwords.
   ```bash
   rg -i "(api.?key|secret|password|token|auth)" --type-add 'src:*.{ts,tsx,js,jsx,json,yaml,yml,md}' -t src
   ```
2. **Injection Vectors**: Review SQL queries for parameterization.
3. **XSS Prevention**: Check that user input is properly escaped in templates.
4. **CSRF Protection**: Verify state-changing operations have CSRF tokens.
5. **Auth & Access Control**: Review authentication and authorization logic.
6. **Data Exposure**: Check what's exposed in client-side code.

## Phase 3 — Configuration Review

1. Check `.env.example` doesn't contain real values.
2. Verify `.gitignore` excludes sensitive files.
3. Review CORS configuration if applicable.
4. Check CSP headers.
5. Verify HTTPS enforcement.

## Phase 4 — Dependency Integrity

1. Check `pnpm-lock.yaml` is committed.
2. Verify no packages are from unofficial registries.
3. Review `package.json` for deprecated packages.
4. Check for packages with low download counts or abandoned maintenance.

## Phase 5 — Privacy Check

1. Load `privacy-first` skill.
2. Scan for personal data (emails, IPs) in codebase:
   ```bash
   rg -i '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' --type-add 'src:*.{ts,tsx,js,jsx,json,yaml,yml,md,html,css}' -t src
   ```
3. Remove or anonymize any found personal data.

## Phase 6 — Report

1. Create comprehensive report in `plans/security-audit-YYYY-MM-DD.md`:
   - Executive summary
   - Critical findings
   - Medium findings
   - Low findings
   - Remediation plan
2. Create issues for any critical findings:
   ```bash
   gh issue create --title "security: [finding]" --body "$FINDING_DETAILS" --label security
   ```
3. Create fix PRs for immediately actionable issues.

## Global Constraints

- **Never** commit actual secrets or credentials.
- **Never** ignore critical/high severity vulnerabilities.
- **Always** document findings before fixing.
- **Always** verify fixes don't break functionality.
