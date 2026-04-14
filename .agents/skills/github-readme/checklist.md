# README Quality Checklist

## Pre-Publication Checklist

### Content (5-Second Test)
- [ ] Project name is clear and memorable
- [ ] Tagline explains what + why in one sentence
- [ ] Visual element present (badge, screenshot, or diagram)
- [ ] Quick links to key resources (docs, examples, issues)
- [ ] "What is this?" section answers: what, who, why

### Quick Start
- [ ] Prerequisites listed with versions and install links
- [ ] Installation command is copy-paste ready
- [ ] First usage example shows expected output
- [ ] Takes under 2 minutes for experienced user
- [ ] Tested on fresh environment

### Structure
- [ ] Headings follow H1 → H2 → H3 hierarchy
- [ ] Sections are skimmable (short paragraphs, bullets)
- [ ] Code examples have language specified
- [ ] Links use descriptive anchor text
- [ ] Progressive disclosure (simple → complex)

### Accessibility
- [ ] All images have descriptive alt text
- [ ] Color is not the only way information is conveyed
- [ ] Emoji used sparingly and decoratively
- [ ] Tables have header rows
- [ ] No information in images alone

### Code Quality
- [ ] All code examples tested and working
- [ ] Comments explain non-obvious parts
- [ ] Realistic variable names and values
- [ ] Expected output shown where helpful

### Links
- [ ] All internal links work
- [ ] All external links tested
- [ ] No broken or 404 links
- [ ] Repository topics set on GitHub

### Polish
- [ ] Spelling and grammar checked
- [ ] Consistent formatting throughout
- [ ] Mobile preview looks good
- [ ] Dark-mode friendly (if using images)

## Testing Process

### 5-Second Test
1. Show README to stranger for 5 seconds
2. Ask: "What does this project do?"
3. Ask: "Who is it for?"
4. If answers unclear → revise tagline and intro

### Quick Start Test
1. Give README to target developer
2. Ask them to install and run
3. Track time and friction points
4. Note any errors or confusion
5. Fix identified issues

### Mobile Preview
```bash
# Use GitHub mobile or browser dev tools
# Check viewport at 375px width
```

Verify:
- [ ] Text readable without zooming
- [ ] Code blocks scroll horizontally
- [ ] Images not too large
- [ ] Navigation usable on small screen

## Section-Specific Checklists

### Project Name & Tagline
- [ ] Name is unique and searchable
- [ ] Tagline is one sentence (max 20 words)
- [ ] Tagline includes key benefit or category
- [ ] Avoids jargon and buzzwords

### Features List
- [ ] 3-5 features maximum
- [ ] Benefit-focused, not technical
- [ ] Each feature has clear value
- [ ] Uses checkmarks or bullets consistently

### Quick Start
- [ ] Maximum 5 steps
- [ ] Each step has copy-paste command
- [ ] Shows expected output
- [ ] Includes troubleshooting for common issues

### Usage Examples
- [ ] 3-5 examples covering common use cases
- [ ] Each example has clear title
- [ ] Code is annotated with comments
- [ ] Expected output shown

### Contributing
- [ ] Link to CONTRIBUTING.md
- [ ] Mentions good first issues
- [ ] Explains how to run tests
- [ ] Describes PR process

### License
- [ ] License file exists
- [ ] License type clearly stated
- [ ] Link to LICENSE file
- [ ] Any additional notices included

## Maintenance Checklist

### Monthly
- [ ] Check all links functional
- [ ] Verify quick start works
- [ ] Update dependency versions in examples

### Quarterly
- [ ] Review for outdated information
- [ ] Add new features to features list
- [ ] Update screenshots if UI changed
- [ ] Check badge URLs still valid

### Per Release
- [ ] Update version badges
- [ ] Add new features to changelog
- [ ] Note breaking changes prominently
- [ ] Update "Last updated" date if using

## Quality Metrics

Track these metrics over time:

| Metric | Target | Current |
|---|---|---|
| Time to first success | < 2 min | |
| 5-second test pass rate | > 80% | |
| Mobile usability | No issues | |
| Link rot (monthly) | < 5% | |
| Contributor onboarding time | < 30 min | |

## Common Issues and Fixes

### Issue: Users don't understand project purpose
**Fix**: Rewrite tagline to include what + who + why

### Issue: Quick start has too many steps
**Fix**: Reduce to 5 steps maximum, move advanced setup to separate guide

### Issue: Code examples don't work
**Fix**: Add examples to test suite, run on CI

### Issue: Links break over time
**Fix**: Add link checker to CI, use relative links where possible

### Issue: README is too long
**Fix**: Move detailed docs to separate files, keep README as overview

### Issue: Mobile readability poor
**Fix**: Use shorter lines in code blocks, break up long paragraphs

## Automation

Add these checks to CI:

```yaml
# .github/workflows/readme-checks.yml
name: README Checks

on: [push, pull_request]

jobs:
  check-readme:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Check links
        uses: lycheeverse/lychee-action@v1
        with:
          args: README.md
      
      - name: Check spelling
        uses: crate-ci/typos@master
      
      - name: Mobile preview
        # Custom script to check mobile rendering
```

## Scorecard

Rate your README (1-5 scale):

| Category | Score | Notes |
|---|---|---|
| Clarity (5-second test) | | |
| Quick Start usability | | |
| Code example quality | | |
| Accessibility | | |
| Visual design | | |
| Link health | | |
| Mobile friendliness | | |
| **Total** | /35 | Target: 28+ |
