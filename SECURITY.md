# Security Policy

## Supported Versions

Security fixes are applied to the latest release on the `main` branch only.

| Version | Supported |
| ------- | --------- |
| latest (`main`) | ✅ |
| older releases  | ❌ |

## Reporting a Vulnerability

**Do not report security vulnerabilities through public issues, pull requests,
or discussions.**

Use [GitHub Private Security Advisories][advisory] to report vulnerabilities
privately to the maintainers.

[advisory]: ../../security/advisories/new

### What to include

- A clear description of the vulnerability and its potential impact
- Affected file(s), component(s), or configuration(s)
- Step-by-step reproduction instructions or a proof-of-concept
- Suggested mitigations or patches, if available

### Response process

1. **Acknowledgement** — as soon as possible
2. **Assessment** — severity and scope evaluation with progress updates
3. **Fix & disclosure** — coordinated release and public advisory upon resolution

## Supply Chain Security

To mitigate the risk of tag mutation or hijacking, all GitHub Actions used in
workflows should be pinned to a full 40-character commit SHA. A comment with the
original version tag should be included on the same line to allow Dependabot
to track and propose updates.

Example:
```yaml
- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
```

## Local-First Security Model

This application is a **local-first** knowledge studio. All data, including API
keys, stays on the user's device.

### API Key Handling

- **User-provided keys**: API keys for LLM providers (OpenRouter, OpenAI, etc.)
  are entered by the user in the application settings UI and stored in the
  browser's `localStorage`.
- **No backend storage**: Keys are never sent to, stored on, or transmitted
  through any server. All LLM API calls are made directly from the browser.
- **VITE_ environment variables**: Variables prefixed with `VITE_` are compiled
  into the JavaScript bundle at build time and are **visible to anyone who
  inspects the client-side source**. These should only be used for user-provided
  API keys, never for developer secrets or infrastructure credentials.
- **No secrets in source code**: API keys must never be hardcoded in source files,
  committed to version control, or included in build artifacts.

### Recommended Practices

- Enter API keys through the application settings UI, not via `.env` files.
- Treat any `VITE_` prefixed variable as public — only use it for values the
  user is willing to expose in the browser.
- Use the audit script (`scripts/audit-vite-env.sh`) to verify no secret
  references leak into the client bundle.

## Scope

This policy covers the source code, workflows, scripts, and configuration files
in this repository. It does not cover vulnerabilities in third-party
dependencies or external services — please report those upstream.
