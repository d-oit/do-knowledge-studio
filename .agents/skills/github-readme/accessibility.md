# README Accessibility Guide

Making your README.md accessible to all developers in 2026.

## Why Accessibility Matters

- **Inclusive**: Welcomes developers with disabilities
- **Better UX**: Accessibility improvements help everyone
- **Legal**: Some organizations require accessible documentation
- **SEO**: Screen reader friendly = search engine friendly

## Quick Checklist

- [ ] All images have descriptive alt text
- [ ] Headings follow logical hierarchy (H1 → H2 → H3)
- [ ] Links have descriptive anchor text
- [ ] Color is not the only way information is conveyed
- [ ] Emoji used sparingly and decoratively
- [ ] Code blocks specify language for syntax highlighting
- [ ] Tables have header rows
- [ ] No information conveyed by images alone

## Images and Alt Text

### DO: Descriptive Alt Text

```markdown
<!-- Good: Explains what the image shows -->
![CLI output showing successful installation with version 2.1.0](assets/install-output.png)

<!-- Good: Explains diagram purpose -->
![Architecture diagram showing request flow from user to API to database](assets/architecture.png)
```

### DON'T: Useless Alt Text

```markdown
<!-- Bad: No information -->
![](image.png)

<!-- Bad: Redundant -->
![Screenshot](screenshot.png)

<!-- Bad: "Image of" is redundant -->
![Image of the installation process](install.png)
```

### Screenshots

Include in alt text:
- **What** is shown (window, CLI, UI element)
- **Key information** visible (version numbers, status)
- **Context** if not obvious from surrounding text

```markdown
<!-- Example -->
![Terminal showing cargo install command completing successfully with output "Finished release in 45s"](assets/cargo-install.png)
```

### Diagrams

For complex diagrams, provide both:
1. **Alt text**: Brief description
2. **Long description**: In text below image or linked page

```markdown
![Architecture: User → Load Balancer → API Servers → Database](assets/arch.png)

**Architecture Overview**:
Requests flow from users through a load balancer, which distributes them across multiple API servers. Each server connects to the primary database for reads and writes.
```

## Headings Structure

### Correct Hierarchy

```markdown
# Project Name (H1 - one only)

## What Is This? (H2)

## Quick Start (H2)

### Prerequisites (H3)

### Installation (H3)

## Usage (H2)

### Basic Usage (H3)

### Advanced Usage (H3)
```

### Common Mistakes

```markdown
<!-- Bad: Skips from H1 to H3 -->
# Project Name

### Quick Start

<!-- Bad: Multiple H1 tags -->
# Project Name

# Tagline

<!-- Bad: Headings out of order -->
## Section 1

#### Subsection (skipped H3)
```

## Links

### Descriptive Anchor Text

**DO**:
```markdown
- Read the [installation guide](installation.md)
- See [API documentation](https://docs.example.com)
- Report issues on [GitHub Issues](https://github.com/org/repo/issues)
```

**DON'T**:
```markdown
- Click [here](installation.md) to install
- Read more [here](https://docs.example.com)
- [This link](https://github.com/org/repo/issues) has issues
```

### Link Purpose

Each link should make sense out of context:

**Screen reader users often navigate by**:
- Link text alone (without surrounding context)
- List of all links on page

**Test**: Read only the link text. Does it make sense?

```markdown
<!-- Good: Clear purpose -->
[Download version 2.1.0](releases/v2.1.0)

<!-- Bad: Unclear without context -->
[Click here](releases/v2.1.0)
```

## Color and Visual Information

### Don't Rely on Color Alone

**Bad** (color only):
```markdown
<span style="color: red">Failed</span>
<span style="color: green">Passed</span>
```

**Good** (color + text):
```markdown
❌ **Failed**
✓ **Passed**

Or use badges with text:
[![Tests: Passing](badge.svg)](link)
```

### Status Indicators

Use icons or text in addition to color:

```markdown
| Status | Meaning |
|---|---|
| 🟢 Passing | All tests successful |
| 🔴 Failing | One or more tests failed |
| 🟡 Pending | Tests running |
```

### Code Syntax Highlighting

Always specify language:

```markdown
<!-- Good: Language specified -->
```rust
fn main() {}
```

<!-- Bad: No language, screen reader can't announce -->
```
fn main() {}
```
```

## Emoji Usage

### Guidelines

- **Use sparingly**: Decorative, not essential
- **Don't overuse**: Max 1-2 per section
- **Provide text alternative**: Don't rely on emoji meaning

**Good**:
```markdown
## Features

✓ **Fast**: Completes in under 1 second
✓ **Safe**: Type-safe by design
✓ **Easy**: One-command installation
```

**Bad**:
```markdown
## Features

🚀⚡🔥 **Fast**: Like a rocket
🛡️🔒 **Safe**: Super secure
🎉✨ **Easy**: So easy!
```

### Common Emoji Meanings

Ensure consistent interpretation:

| Emoji | Common Meaning | Use For |
|---|---|---|
| ✓ | Success, done | Completed items |
| ❌ | Error, failed | Warnings, errors |
| ⚠️ | Warning, caution | Important notes |
| 💡 | Idea, tip | Tips, suggestions |
| 📚 | Books, docs | Documentation links |
| 🔗 | Link | External resources |

## Tables

### Accessible Table Structure

```markdown
| Feature | Description | Example |
|---|---|---|
| Fast | Executes quickly | `command --fast` |
| Safe | Type-checked | Compile-time errors |
```

**Requirements**:
- Header row (first row)
- Consistent columns
- No merged cells (not supported in markdown)

### Complex Tables

For complex data, consider:
1. **Simplify**: Break into multiple tables
2. **Describe**: Add explanation before table
3. **Alternative**: Provide data in list format

```markdown
### Configuration Options

| Option | Type | Default | Description |
|---|---|---|---|
| `--port` | Integer | 8080 | Port to listen on |
| `--host` | String | localhost | Host address |

Or as a list (more accessible):

**Configuration Options**:
- **`--port`** (Integer, default: 8080): Port to listen on
- **`--host`** (String, default: localhost): Host address
```

## Code Examples

### Accessibility Best Practices

**1. Add Comments**

```rust
// Initialize the database connection
let db = Database::connect()?;

// Execute query with timeout
let results = db.query_timeout(sql, 5000)?;
```

**2. Explain Expected Output**

```bash
$ cargo build
   Compiling my-project v0.1.0
    Finished dev [unoptimized + debuginfo] target(s) in 12.5s
```

**3. Avoid Relying on Color**

Syntax highlighting is nice, but ensure code is readable without it:

```markdown
<!-- Good: Clear even without colors -->
```python
def greet(name):
    return f"Hello, {name}!"
```
```

## Testing Accessibility

### Manual Tests

**1. Screen Reader Test**

Use free screen readers:
- **NVDA** (Windows, free)
- **VoiceOver** (macOS/iOS, built-in)
- **Orca** (Linux, free)

Test: Navigate README using only keyboard and screen reader.

**2. No-Images Test**

Disable images in browser. Can you still understand everything?

**3. Grayscale Test**

View in grayscale. Is information still clear without color?

### Automated Checks

**Markdown Linters**:

```bash
# markdownlint checks heading structure
markdownlint README.md
```

**Link Checkers**:

```bash
# lychee checks all links
lychee README.md
```

### Browser DevTools

**Chrome/Edge**:
1. Open DevTools (F12)
2. Run Lighthouse accessibility audit
3. Fix reported issues

**Firefox**:
1. Open Developer Tools
2. Accessibility panel
3. Check contrast and structure

## Common Issues and Fixes

### Issue: Images Missing Alt Text

**Fix**:
```markdown
<!-- Before -->
![Screenshot](screenshot.png)

<!-- After -->
![Installation completing successfully with "Done" message](screenshot.png)
```

### Issue: Headings Out of Order

**Fix**:
```markdown
<!-- Before -->
# Title

#### Subtitle (skipped H2, H3)

<!-- After -->
# Title

## Subtitle
```

### Issue: Undescriptive Links

**Fix**:
```markdown
<!-- Before -->
Click [here](docs/guide.md) for the guide.

<!-- After -->
Read the [installation guide](docs/guide.md).
```

### Issue: Color-Only Status

**Fix**:
```markdown
<!-- Before -->
<span style="color: green">Build: Success</span>

<!-- After -->
✓ **Build: Success**
```

## Tools and Resources

### Validators

- **WAVE**: Web accessibility evaluation tool
- **axe DevTools**: Browser extension
- **Lighthouse**: Built into Chrome

### Screen Readers

- **NVDA**: Free, Windows
- **VoiceOver**: Built into macOS/iOS
- **JAWS**: Commercial, Windows
- **Orca**: Free, Linux

### Guidelines

- **WCAG 2.1**: Web Content Accessibility Guidelines
- **WAI-ARIA**: Accessible Rich Internet Applications
- **Section 508**: US government standard

## Summary

Accessibility checklist for README:

1. ✓ **Images**: Descriptive alt text
2. ✓ **Headings**: Logical hierarchy
3. ✓ **Links**: Descriptive anchor text
4. ✓ **Color**: Not the only information carrier
5. ✓ **Emoji**: Sparing and decorative
6. ✓ **Code**: Language specified, commented
7. ✓ **Tables**: Header rows present
8. ✓ **Test**: Screen reader, no-images, grayscale

Accessible READMEs are better READMEs - clearer, more usable, and welcoming to all developers.
