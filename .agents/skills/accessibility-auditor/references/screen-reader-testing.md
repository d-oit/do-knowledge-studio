# Screen Reader Testing Guide

Comprehensive procedures for testing web applications with screen readers.

## Testing Environment Setup

### Screen Reader Options

| Screen Reader | Platform | Best For |
|---------------|----------|----------|
| NVDA | Windows | Free, widely used, good for testing |
| JAWS | Windows | Enterprise standard |
| VoiceOver | macOS/iOS | Native Apple testing |
| TalkBack | Android | Mobile accessibility |

### NVDA Setup (Recommended)

1. Download from [nvaccess.org](https://www.nvaccess.org/)
2. Install with default settings
3. Key commands:
   - `Insert + F7` - Elements list
   - `Insert + Space` - Focus mode toggle
   - `H` - Next heading
   - `T` - Next table
   - `F` - Next form field
   - `L` - Next list
   - `B` - Next button

## Testing Checklist

### Basic Navigation

- [ ] Page title announced on load
- [ ] Headings hierarchy makes sense (H1→H2→H3)
- [ ] Skip link works and is visible on focus
- [ ] Landmarks announced correctly (main, nav, aside, etc.)
- [ ] Focus order is logical

### Forms

- [ ] All inputs have labels
- [ ] Required fields announced
- [ ] Error messages associated with inputs
- [ ] Fieldsets group related controls
- [ ] Instructions announced before input

### Interactive Elements

- [ ] Buttons describe their action
- [ ] Links make sense out of context
- [ ] Modals trap focus and announce
- [ ] Dropdowns work with arrow keys
- [ ] Tabs announce state (selected/unselected)

### Dynamic Content

- [ ] Live regions announce updates
- [ ] Loading states are announced
- [ ] Status messages are not disruptive
- [ ] Form submissions confirm success

## Common Issues

### 1. Missing Alt Text
```html
<!-- Bad -->
<img src="chart.png">

<!-- Good -->
<img src="chart.png" alt="Q4 revenue increased 23% to $2.4M">
```

### 2. Decorative Images Not Hidden
```html
<!-- Bad -->
<img src="divider.png" alt="divider">

<!-- Good -->
<img src="divider.png" alt="" role="presentation">
```

### 3. Form Labels Missing
```html
<!-- Bad -->
<span>Email</span>
<input type="email">

<!-- Good -->
<label for="email">Email</label>
<input type="email" id="email">
```

### 4. Headings Skipped
```html
<!-- Bad -->
<h1>Title</h1>
<h3>Subtitle</h3>

<!-- Good -->
<h1>Title</h1>
<h2>Subtitle</h2>
```

## Testing Procedures

### Procedure 1: Navigation Test

1. Close your eyes
2. Tab through entire page
3. Note what is announced
4. Verify logical flow

### Procedure 2: Form Completion

1. Navigate to form
2. Fill out each field
3. Submit form with errors
4. Verify error announcements
5. Correct errors and resubmit

### Procedure 3: Component Testing

1. Test modal dialog
   - Trigger with button
   - Verify focus moves to modal
   - Tab within modal (should trap)
   - Close with Escape
   - Verify focus returns to trigger

2. Test dropdown
   - Open with Enter/Space
   - Navigate with arrow keys
   - Select with Enter
   - Close with Escape

## Output Format

```
Screen Reader Test Report
==========================

Tested: [Date]
Screen Reader: [NVDA/JAWS/VoiceOver]
Browser: [Chrome/Firefox/Safari]

Findings:
- [ ] PASS: Page title announced
- [ ] FAIL: Missing alt text on hero image (line 45)
  - Impact: Screen reader users can't understand content
  - Fix: Add descriptive alt text

- [ ] PASS: Form labels associated correctly

Recommendations:
1. [Priority] Fix critical issues first
2. [Priority] Add skip link to main content
3. [Priority] Test with actual screen reader users
```

## Automated Testing Tools

- **axe DevTools** - Browser extension
- **WAVE** - WebAIM evaluation tool
- **Lighthouse** - Built into Chrome DevTools

Note: Automated tools catch ~30% of issues. Manual screen reader testing is essential.
