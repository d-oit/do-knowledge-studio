# Color Contrast Guide

Understanding and calculating WCAG-compliant color contrast ratios.

## WCAG Contrast Requirements

### Conformance Levels

| Level | Normal Text | Large Text (18pt+) | UI Components/Graphics |
|-------|-------------|-------------------|---------------------|
| AA | 4.5:1 | 3:1 | 3:1 |
| AAA | 7:1 | 4.5:1 | Not specified |

### What Counts as Large Text

- 18pt (24px) or larger, OR
- 14pt (18.5px) bold or larger

## Contrast Ratio Formula

The WCAG contrast ratio formula:

```
(L1 + 0.05) / (L2 + 0.05)
```

Where:
- L1 = Relative luminance of lighter color
- L2 = Relative luminance of darker color

### Relative Luminance Calculation

```
L = 0.2126 * R + 0.7152 * G + 0.0722 * B
```

Where R, G, B are sRGB components normalized to 0-1.

## Quick Reference

### Common Color Combinations

| Foreground | Background | Ratio | WCAG AA |
|-----------|-----------|-------|---------|
| #000000 (black) | #FFFFFF (white) | 21:1 | ✓ Pass |
| #333333 (dark gray) | #FFFFFF | 12.6:1 | ✓ Pass |
| #666666 (gray) | #FFFFFF | 5.7:1 | ✓ Pass |
| #999999 (light gray) | #FFFFFF | 2.8:1 | ✗ Fail |
| #FFFFFF (white) | #0066CC (blue) | 4.6:1 | ✓ Pass |
| #FFFFFF | #66B2FF (light blue) | 2.3:1 | ✗ Fail |
| #000000 | #FFFF00 (yellow) | 19.5:1 | ✓ Pass |

### Safe Color Palettes

#### Primary Action
```css
.btn-primary {
  color: #FFFFFF;
  background-color: #0056B3; /* 7.2:1 ratio */
}
```

#### Secondary/Text
```css
.text-secondary {
  color: #6C757D; /* 4.6:1 on white */
}
```

#### Error/Warning
```css
.error-text {
  color: #DC3545; /* 7.1:1 on white */
}
```

## Testing Tools

### Online Tools
- **WebAIM Contrast Checker** - webaim.org/resources/contrastchecker/
- **Stark** - getstark.co (plugin for Figma/Sketch)
- **Colour Contrast Analyser** - TPGi desktop app

### Browser DevTools
- Chrome: DevTools → Elements → Styles → Color picker shows contrast ratio
- Firefox: Accessibility tab shows contrast warnings

### NPM Packages
```bash
npm install color-contrast-checker
npm install @axe-core/cli
```

## Fixing Contrast Issues

### Issue 1: Light Gray on White
```css
/* Bad - 2.8:1 ratio */
.text-muted {
  color: #999999;
}

/* Good - 4.6:1 ratio */
.text-muted {
  color: #767676;
}
```

### Issue 2: Blue Link on Dark Background
```css
/* Bad */
.dark-bg a {
  color: #66B2FF; /* 2.9:1 on dark */
}

/* Good */
.dark-bg a {
  color: #4DA6FF; /* 4.5:1 on dark */
}
```

### Issue 3: Placeholder Text
```css
/* Bad */
input::placeholder {
  color: #CCCCCC; /* 1.6:1 on white */
}

/* Good */
input::placeholder {
  color: #767676; /* 4.6:1 on white */
}
```

## Special Cases

### Images of Text
Must meet same contrast requirements as text.

### Logos and Branding
Exempt from contrast requirements but should still be as accessible as possible.

### Incidental Text
- Inactive/disabled elements
- Decorative text
- Logos

These are exempt but consider using reduced opacity (50-60%) to indicate state.

### Gradient Backgrounds
Test contrast at the lightest and darkest points of the gradient.

```css
/* Test both endpoints */
.gradient-text {
  background: linear-gradient(to right, #333, #666);
  -webkit-background-clip: text;
  color: transparent;
}
```

## Output Format

```
Color Contrast Audit Report
===========================

Tested: [Date]
Tool: [WebAIM/axe/Stark]

Findings:
Component: Primary Button
- Foreground: #FFFFFF
- Background: #007BFF
- Ratio: 4.5:1
- WCAG AA: ✓ PASS

Component: Secondary Text
- Foreground: #6C757D
- Background: #FFFFFF
- Ratio: 4.6:1
- WCAG AA: ✓ PASS

Component: Placeholder Text (CRITICAL)
- Foreground: #CCCCCC
- Background: #FFFFFF
- Ratio: 1.6:1
- WCAG AA: ✗ FAIL (needs 4.5:1)
- Recommendation: Change to #767676 (4.6:1)

Summary:
- Pass: 12/15 components
- Fail: 3/15 components
- Priority fixes: Placeholder text, disabled states
```

## Testing Checklist

- [ ] All body text meets 4.5:1 minimum
- [ ] All large text meets 3:1 minimum
- [ ] All UI components (buttons, inputs) meet 3:1 minimum
- [ ] Focus indicators meet 3:1 against background
- [ ] Placeholder text is not too light
- [ ] Disabled states are still distinguishable
- [ ] Links are distinguishable from surrounding text
