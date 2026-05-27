# Codacy Configuration Format

Codacy can be configured via a `.codacy.yaml` file in the repository root.

## Schema

```yaml
---
engines:
  eslint-9:
    exclude_paths:
      - "dist/**"
      - "coverage/**"
  duplication:
    exclude_paths:
      - "dist/**"
      - "coverage/**"
    config:
      languages:
        - "typescript"
        - "javascript"
exclude_paths:
  - "dist/**"
  - "coverage/**"
  - "**/node_modules/**"
```

## Local Initialization

You can generate a default configuration using:

```bash
codacy-analysis init --default
```
