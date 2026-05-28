# Supported Codacy Tools

Codacy supports hundreds of tools, but only a subset are available in the local Analysis CLI.

## Local Analysis CLI Support

| Tool | Language | Status |
|------|----------|--------|
| ESLint9 | JavaScript/TypeScript | ✅ Supported |
| Stylelint | CSS/SCSS | ✅ Supported |
| ShellCheck | Shell | ✅ Supported |
| Trivy | Security/IAC | ✅ Supported |
| markdownlint | Markdown | ✅ Supported |
| Bandit | Python | ❌ Fails (venv) |
| Pylint | Python | ❌ Fails (venv) |
| SQLint | SQL | ❌ Fails (Ruby) |
| PMD | Java | ❌ Fails (Java) |

## Cloud Analysis

The Codacy Cloud (Remote) analysis runs all enabled tools in the Codacy dashboard regardless of local runtime availability. Always use `codacy pull-request` to see the full list of issues.
