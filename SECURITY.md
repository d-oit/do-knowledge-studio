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

## Scope

This policy covers the source code, workflows, scripts, and configuration files
in this repository. It does not cover vulnerabilities in third-party
dependencies or external services — please report those upstream.
