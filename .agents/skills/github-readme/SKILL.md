---
name: github-readme
description: Create human-focused GitHub README.md files with 2026 best practices. Use when creating new projects, improving documentation, adding quick start guides, writing contribution guidelines, or making repositories more discoverable and user-friendly.
---

# GitHub README Creator

Expert skill for crafting human-focused README.md files that prioritize clarity, discoverability, and developer experience following 2026 best practices.

## Quick Start Checklist

```
README Quality Checklist:
- [ ] Project name and tagline (5-second understanding)
- [ ] Visual element (badge, diagram, or screenshot)
- [ ] Quick start (under 2 minutes)
- [ ] Clear "What is this?" section
- [ ] Installation instructions
- [ ] Basic usage example
- [ ] Link to full documentation
- [ ] Contribution guidelines
- [ ] License and credits
- [ ] Accessibility check (screen reader friendly)
```

## When to Use

Use this skill when you need to:
- Create a new README.md for a project
- Improve existing repository documentation
- Add quick start guides for new users
- Write contribution guidelines
- Make projects more discoverable on GitHub
- Add badges, diagrams, or visual elements

## Core Principles (2026 Best Practices)

### 1. Human-First Design

Write for humans, not search engines or bots. Use conversational tone, avoid unexplained jargon, and answer "Why should I care?" in the first 10 seconds.

### 2. 5-Second Rule

Reader must understand project purpose within 5 seconds:
```markdown
# Project Name

One-sentence tagline explaining what this does and why it matters.

[Visual: Badge | Screenshot | Diagram]

Quick links: [Docs](https://example.com/docs) | [Examples](https://example.com/examples) | [Issues](https://github.com/user/repo/issues)
```

### 3. Progressive Disclosure

Layer information from simple to complex:
1. **Surface** (5 seconds): Name, tagline, visual
2. **Quick Start** (2 minutes): Install and run
3. **Core Concepts** (10 minutes): How it works
4. **Deep Dive** (30+ minutes): Architecture, API, advanced
5. **Reference**: Full documentation links

### 4. Accessibility First

Requirements:
- Alt text for all images (format: `![Description](image-url)`)
- Semantic headings (H1 → H2 → H3, not skipped)
- Descriptive link text (not "click here")
- Screen reader friendly emoji use (sparingly)

## README Structure Template

```markdown
# Project Name

[Clear one-sentence tagline]

[Visual: Badges, screenshot, or architecture diagram]

**Quick Links**: [Documentation](https://example.com/docs) · [Examples](https://example.com/examples) · [API Reference](https://example.com/api) · [Issues](https://github.com/user/repo/issues)

---

## What Is This?

[2-3 sentence explanation in plain language]

**Key Features**:
- ✓ Feature 1 (benefit-focused)
- ✓ Feature 2
- ✓ Feature 3

## Quick Start (2 Minutes)

### Prerequisites
- List required tools/versions

### Installation
```bash
command install project-name
```

### First Usage
```bash
project-name --help
```

## Core Concepts

[Brief explanation of 3-5 key concepts]

## Usage Examples

[Show 3-5 common use cases with code]

## Documentation

- 📚 **[Full Documentation](https://example.com/docs)** - Complete guides
- 📖 **[API Reference](https://example.com/api)** - API documentation
- 🧪 **[Examples](https://example.com/examples)** - Working code examples

## Contributing

We welcome contributions! See [Contributing Guide](https://github.com/user/repo/blob/main/CONTRIBUTING.md).

## License

This project is licensed under the [MIT License](https://github.com/user/repo/blob/main/LICENSE).
```

## Writing Style Guidelines

### Tone
- **Friendly**: Use "you" and "we"
- **Confident**: State capabilities clearly
- **Humble**: Acknowledge limitations

### Sentence Structure
- **Short**: 15-20 words maximum
- **Active voice**: "This tool generates" not "README is generated"
- **Parallel structure**: Keep list items grammatically consistent

### Code Examples
- **Annotated**: Add comments explaining non-obvious parts
- **Complete**: Copy-paste should work
- **Tested**: Verify examples actually work

## Accessibility Checklist

Before publishing, verify:
- [ ] All images have descriptive alt text
- [ ] Headings are in logical order (H1 → H2 → H3)
- [ ] Links have descriptive text (not "click here")
- [ ] Color is not the only way information is conveyed
- [ ] Code blocks have language specified

## Quality Gate

Run this checklist before merging README changes:

```markdown
README Quality Gate:
- [ ] 5-second test: Can stranger understand purpose?
- [ ] Quick start works end-to-end (tested)
- [ ] All links functional
- [ ] All images have alt text
- [ ] Headings are hierarchical
- [ ] Code examples are tested and current
- [ ] Mobile-friendly (preview on phone)
```

## Common Anti-Patterns

### ❌ Wall of Text
Avoid long paragraphs. Use bullet points and short sections.

### ❌ Assumed Knowledge
Include prerequisites and link to installation guides.

### ❌ Broken Links
Use relative links for internal files. Test all external links.

### ❌ Outdated Information
Add "Last updated: YYYY-MM" badge. Update screenshots when UI changes.

## Integration with Other Skills

- **skill-creator**: Use when creating documentation skills
- **shell-script-quality**: Apply quality patterns to README scripts
- **web-search-researcher**: Research best practices and competitor READMEs
- **iterative-refinement**: Improve README through multiple passes

## Summary

Creating effective README files:
1. **Human-First**: Write for people, not bots
2. **5-Second Rule**: Clear purpose immediately
3. **Quick Start**: Get running in 2 minutes
4. **Progressive Disclosure**: Simple → complex
5. **Accessibility**: Screen reader friendly
6. **Visual**: Badges, diagrams, screenshots
7. **Examples**: Show, don't tell
8. **Links**: Point to deeper documentation
9. **Contributing**: Make it easy to help
10. **Maintain**: Keep current and accurate

A great README is the single most important factor in project adoption and contributor engagement.

## Reference Files

- `references/guide.md` - Complete section-by-section guidance, detailed examples, templates, writing style, accessibility checklist, SEO tips, multilingual READMEs, anti-patterns, testing methods, and maintenance guide
