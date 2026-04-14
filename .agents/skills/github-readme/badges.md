# Badges for README.md

Badge best practices and generation guide for 2026.

## Principles

### DO
- ✓ Use 3-5 badges maximum (above the fold)
- ✓ Choose badges that matter to users (tests, license, version)
- ✓ Ensure badges are accessible (color contrast)
- ✓ Link badges to relevant pages
- ✓ Use shields.io or official badge sources

### DON'T
- ✗ Add every possible badge (badge fatigue)
- ✗ Use badges that don't update automatically
- ✗ Include badges for irrelevant metrics
- ✗ Use low-contrast badge colors
- ✗ Make badges too large

## Essential Badges

### Build Status

```markdown
[![Tests](https://github.com/your-org/your-repo/actions/workflows/test.yml/badge.svg)](https://github.com/your-org/your-repo/actions/workflows/test.yml)
```

**When to use**: Always for projects with CI

### License

```markdown
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
```

**Common licenses**:
- MIT: `License-MIT-yellow.svg`
- Apache 2.0: `License-Apache_2.0-blue.svg`
- GPL 3.0: `License-GPLv3-blue.svg`
- BSD 3-Clause: `License-BSD_3--Clause-blue.svg`

### Version/Release

```markdown
[![Latest Release](https://img.shields.io/github/v/release/your-org/your-repo)](https://github.com/your-org/your-repo/releases)
```

### Package Downloads

**Crates.io (Rust)**:
```markdown
[![Crates.io](https://img.shields.io/crates/v/crate-name.svg)](https://crates.io/crates/crate-name)
[![Downloads](https://img.shields.io/crates/d/crate-name.svg)](https://crates.io/crates/crate-name)
```

**npm (JavaScript)**:
```markdown
[![npm version](https://img.shields.io/npm/v/package-name.svg)](https://www.npmjs.com/package/package-name)
[![Downloads](https://img.shields.io/npm/dm/package-name.svg)](https://www.npmjs.com/package/package-name)
```

**PyPI (Python)**:
```markdown
[![PyPI version](https://img.shields.io/pypi/v/package-name.svg)](https://pypi.org/project/package-name/)
[![Downloads](https://static.pepy.tech/badge/package-name)](https://pepy.tech/project/package-name)
```

## Quality Badges

### Code Coverage

**Codecov**:
```markdown
[![Coverage](https://codecov.io/gh/your-org/your-repo/branch/main/graph/badge.svg)](https://codecov.io/gh/your-org/your-repo)
```

**Coveralls**:
```markdown
[![Coverage Status](https://coveralls.io/repos/github/your-org/your-repo/badge.svg?branch=main)](https://coveralls.io/github/your-org/your-repo?branch=main)
```

### Code Quality

**Code Climate**:
```markdown
[![Maintainability](https://api.codeclimate.com/v1/badges/your-id/maintainability)](https://codeclimate.com/github/your-org/your-repo/maintainability)
```

**Rust Clippy**:
```markdown
[![Clippy](https://github.com/your-org/your-repo/actions/workflows/clippy.yml/badge.svg)](https://github.com/your-org/your-repo/actions/workflows/clippy.yml)
```

## Platform Badges

### GitHub

**Stars**:
```markdown
[![GitHub stars](https://img.shields.io/github/stars/your-org/your-repo.svg?style=social&label=Star)](https://github.com/your-org/your-repo)
```

**Issues**:
```markdown
[![Issues](https://img.shields.io/github/issues/your-org/your-repo.svg)](https://github.com/your-org/your-repo/issues)
```

**Discussions**:
```markdown
[![Discussions](https://img.shields.io/github/discussions/your-org/your-repo)](https://github.com/your-org/your-repo/discussions)
```

### Community

**Discord**:
```markdown
[![Discord](https://img.shields.io/discord/server-id.svg?label=&logo=discord&logoColor=ffffff&color=7389D8&labelColor=6A7EC2)](https://discord.gg/invite-code)
```

**Twitter/X**:
```markdown
[![Twitter Follow](https://img.shields.io/twitter/follow/username?style=social)](https://twitter.com/username)
```

## Technology Badges

### Built With

Show technologies used:

```markdown
![Rust](https://img.shields.io/badge/Rust-black?style=for-the-badge&logo=rust&logoColor=#E57324)
![TypeScript](https://img.shields.io/badge/TypeScript-black?style=for-the-badge&logo=typescript&logoColor=#3178C6)
![Python](https://img.shields.io/badge/Python-black?style=for-the-badge&logo=python&logoColor=#3776AB)
```

### Compatibility

**Rust Version**:
```markdown
![Rust Version](https://img.shields.io/badge/rustc-1.70+-blue.svg)
```

**Python Version**:
```markdown
![Python Version](https://img.shields.io/badge/python-3.10+-blue.svg)
```

**Node Version**:
```markdown
![Node Version](https://img.shields.io/badge/node-18+-green.svg)
```

## Badge Placement

### Recommended Layout

```markdown
# Project Name

Tagline here.

[![Tests](link)](link)
[![Coverage](link)](link)
[![License](link)](link)
[![Release](link)](link)

**Quick Links**: [Docs](link) · [Examples](link) · [Issues](link)

---
```

### Alternative: Compact

```markdown
# Project Name

Tagline. [![Tests](link)](link) [![License](link)](link) [![Release](link)](link)

---
```

## Badge Generators

### Shields.io

Main badge generator: https://shields.io/

**Features**:
- Thousands of integrations
- Custom badges
- Flat, flat-square, plastic styles
- Color customization

### For The Badge

Alternative style: https://forthebadge.com/

**Style**:
- Larger, more prominent
- Bold colors
- Good for technology badges

## Accessibility

### Color Contrast

Ensure badges meet WCAG AA standards:
- Normal text: 4.5:1 contrast ratio
- Large text: 3:1 contrast ratio

**Good combinations**:
- ✓ Black text on yellow background (MIT license)
- ✓ White text on blue background (standard)
- ✓ White text on green background (success)

**Avoid**:
- ✗ Light gray on white
- ✗ Yellow on white
- ✗ Red on green (color blindness)

### Alt Text

GitHub automatically uses badge text as alt text. Ensure it's descriptive:

**Good**: `![Tests](badge.svg)` → "Tests passing"
**Bad**: `![badge](badge.svg)` → "badge"

### Don't Rely on Color Alone

If using color to indicate status:
- Add text label: "Tests: Passing" not just green badge
- Include link to details for context

## Dynamic Badges

### GitHub Actions

Auto-updating based on workflow:

```yaml
# In workflow file
name: Tests
on: [push]
jobs:
  test:
    # Badge URL will be:
    # https://github.com/owner/repo/actions/workflows/test.yml/badge.svg
```

### External Services

**Codecov**: Updates on each push with coverage data
**Dependabot**: Shows current dependency status
**Release Watch**: Auto-updates on new releases

## Badge Maintenance

### Monthly Checks

- [ ] All badge links work
- [ ] Badges display correctly
- [ ] Colors still have good contrast
- [ ] Remove badges for discontinued services

### When to Remove Badges

- Service no longer maintained
- Metric no longer relevant
- Badge breaks frequently
- Too many badges (consolidate)

## Complete Example

```markdown
# My CLI Tool

A fast, type-safe CLI framework for Rust developers.

[![Tests](https://github.com/d-o-hub/my-cli/actions/workflows/test.yml/badge.svg)](https://github.com/d-o-hub/my-cli/actions)
[![Coverage](https://codecov.io/gh/d-o-hub/my-cli/branch/main/graph/badge.svg)](https://codecov.io/gh/d-o-hub/my-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Latest Release](https://img.shields.io/github/v/release/d-o-hub/my-cli)](https://github.com/d-o-hub/my-cli/releases)

**Quick Links**: [Documentation](https://my-cli.dev) · [Examples](examples/) · [API Reference](https://docs.rs/my-cli)

---
```

## Tools

### Badge Validators

- **Shields.io validator**: Check badge URLs
- **Lychee**: Link checker that validates badge URLs

### Badge Collections

- **shields.io**: Main collection
- **simpleicons.org**: Technology logos
- **badgen.net**: Alternative badge service

## Summary

Badge best practices:
1. **Less is more**: 3-5 essential badges
2. **Link everything**: Badges should be clickable
3. **Check contrast**: Ensure accessibility
4. **Keep current**: Remove broken badges
5. **Placement matters**: Above the fold, below tagline
