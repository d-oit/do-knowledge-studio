---
name: accessibility-auditor
description: Audit web applications for WCAG 2.2 compliance, screen reader compatibility, keyboard navigation, and color contrast. Triggers on "accessibility audit", "a11y check", "WCAG compliance", "screen reader test", "keyboard navigation", "color contrast check", "ARIA validation", "wcag", " Section 508", "ADA compliance".
license: MIT
---

# Accessibility Auditor

Audit web applications for WCAG 2.2 compliance, screen reader compatibility, keyboard navigation, and color contrast issues.

## When to Use

- Validating WCAG 2.2 AA compliance for legal requirements
- Testing screen reader compatibility (NVDA, JAWS, VoiceOver)
- Auditing keyboard navigation (Tab order, focus indicators)
- Checking color contrast ratios (WCAG 1.4.3, 1.4.6)
- Validating ARIA attributes and semantic HTML
- Pre-launch accessibility review
- Remediating flagged accessibility issues

## Quick Start

```
1. Select audit scope (full page, component, or workflow)
2. Choose WCAG level (A, AA, or AAA)
3. Run automated + manual checks
4. Generate prioritized remediation report
```

## Audit Workflow

### Phase 1: Automated Scan
Check these automatically:

| Check | Tool/Method | WCAG Criteria |
|-------|-------------|---------------|
| Color contrast | axe-core, WAVE | 1.4.3, 1.4.11 |
| Missing alt text | axe-core | 1.1.1 |
| Form labels | Lighthouse | 1.3.1, 3.3.2 |
| Heading hierarchy | axe-core | 1.3.1 |
| ARIA validity | W3C validator | 4.1.2 |
| Keyboard traps | Manual test | 2.1.2 |

### Phase 2: Manual Testing

**Screen Reader Testing:**
```
1. Enable NVDA/VoiceOver/JAWS
2. Navigate entire page with arrow keys
3. Verify all content is announced
4. Check form labels and error messages
5. Test skip links (2.4.1 Bypass Blocks)
```

**Keyboard Navigation:**
```
1. Unplug mouse - navigate with Tab only
2. Verify Tab order matches visual flow
3. Check focus indicators are visible (2.4.7)
4. Test Escape closes modals
5. Verify no keyboard traps (2.1.2)
```

**Zoom Testing:**
```
1. Zoom to 200%, 400%
2. Check content doesn't overflow
3. Verify no horizontal scroll at 320px
4. Test reflow (WCAG 1.4.10)
```

### Phase 3: Compliance Assessment

Score each criterion:

| Status | Definition |
|--------|------------|
| Pass | Meets criterion fully |
| Fail | Violates criterion |
| N/A | Not applicable to this content |
| Partial | Meets with exceptions |

## Severity Classification

| Severity | WCAG Level | User Impact | Priority |
|----------|------------|-------------|----------|
| **Critical** | Level A | Blocks access | Fix immediately |
| **High** | Level AA | Significant barrier | Fix before release |
| **Medium** | Level AAA | Minor friction | Fix in next sprint |
| **Low** | Best practice | Enhancement | Backlog |

## Common Issues & Remedies

### Images Missing Alt Text (1.1.1)
```html
<!-- Bad -->
<img src="chart.png">

<!-- Good -->
<img src="chart.png" alt="Q3 revenue increased 23% to $1.2M">

<!-- Decorative -->
<img src="divider.png" alt="">
```

### Insufficient Color Contrast (1.4.3)
```css
/* Bad - 2.8:1 ratio */
.button { color: #888; background: #fff; }

/* Good - 7:1 ratio (AAA) */
.button { color: #000; background: #fff; }
```

### Missing Form Labels (3.3.2)
```html
<!-- Bad -->
<input type="email" placeholder="Enter email">

<!-- Good -->
<label for="email">Email Address</label>
<input type="email" id="email" required>
```

### Keyboard Traps (2.1.2)
```javascript
// Bad - no escape
<div onKeyDown={handleKey} />

// Good - Escape closes
<div onKeyDown={(e) => {
  if (e.key === 'Escape') closeModal();
}} />
```

## WCAG 2.2 Quick Reference

**Level A (Must Fix):**
- 1.1.1 Non-text Content (alt text)
- 1.3.1 Info and Relationships (semantic HTML)
- 2.1.1 Keyboard Accessible
- 2.4.3 Focus Order
- 4.1.2 Name, Role, Value (ARIA)

**Level AA (Should Fix):**
- 1.4.3 Contrast (4.5:1 for text)
- 1.4.4 Resize Text (200% zoom)
- 2.4.7 Focus Visible
- 3.3.3 Error Suggestion
- 4.1.3 Status Messages

**Level AAA (Nice to Have):**
- 1.4.6 Contrast (7:1 for text)
- 2.1.3 No Keyboard Exceptions
- 3.3.5 Help (context-sensitive)

## Tools Integration

**Recommended Stack:**
- **axe-core** - Automated testing engine
- **Lighthouse** - Chrome DevTools integration
- **WAVE** - Visual feedback tool
- **NVDA** - Free Windows screen reader
- **VoiceOver** - macOS built-in screen reader
- **Color Contrast Analyzer** - Paciello Group tool

## Output Format

```markdown
## Accessibility Audit Report

**Scope:** [page/component]
**WCAG Level:** AA
**Date:** [date]

### Summary
- Critical: 2
- High: 5
- Medium: 8
- Low: 3

### Critical Issues (Fix Immediately)

#### 1. Missing Alt Text on Product Images (1.1.1)
- **Impact:** Screen readers announce "image" with no context
- **Location:** /products page, 12 images
- **Fix:** Add descriptive alt text
- **Before:** `<img src="product-123.jpg">`
- **After:** `<img src="product-123.jpg" alt="Red running shoes, size 10">`

### High Priority
...

### Remediation Checklist
- [ ] Fix critical issues
- [ ] Re-test with screen reader
- [ ] Verify keyboard navigation
- [ ] Run automated scanner
```

## Legal Context

| Jurisdiction | Standard | Enforcement |
|--------------|----------|-------------|
| USA | ADA, Section 508 | DOJ enforcement |
| EU | EN 301 549 | Public sector required |
| Canada | ACA | Federal sites required |
| UK | Equality Act | Disability discrimination |

## References

- `references/wcag-checklist.md` - Complete WCAG 2.2 criteria
- `references/aria-guide.md` - ARIA authoring practices
- `references/screen-reader-testing.md` - Testing procedures
- `references/color-contrast.md` - Contrast calculations

## Examples

### Audit a Component
```
Audit this React login form for WCAG AA compliance
```

### Full Page Audit
```
Run accessibility audit on /checkout page
```

### Remediation Guidance
```
Fix these flagged issues:
1. Images without alt text
2. Form inputs without labels
3. Low contrast text
4. Missing skip link
```

## Troubleshooting

**False positives:** Manual verification required
**ARIA conflicts:** Prefer native HTML, see [references/aria-guide.md](references/aria-guide.md)
**Legacy content:** Prioritize user-facing pages

## Version

WCAG 2.2 (October 2023)
