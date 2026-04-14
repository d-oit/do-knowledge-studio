# WCAG 2.2 Complete Checklist

Reference guide for all WCAG 2.2 success criteria organized by principle.

## Principle 1: Perceivable

### 1.1 Text Alternatives

#### 1.1.1 Non-text Content (Level A)
- All images have appropriate alt text
- Decorative images use alt="" or CSS background
- Complex images (charts, diagrams) have long descriptions
- Form buttons have descriptive values
- CAPTCHA has alternative access methods

**Tests:**
- Screen reader announces meaningful description
- Decorative images ignored by AT
- User can access long description

### 1.2 Time-based Media

#### 1.2.1 Audio-only/Video-only (Level A)
- Audio has transcript
- Video has audio description or text transcript

#### 1.2.2 Captions (Prerecorded) (Level A)
- All prerecorded video has synchronized captions

#### 1.2.3 Audio Description (Prerecorded) (Level A)
- Audio description provided OR full text alternative

#### 1.2.4 Captions (Live) (Level AA)
- Live audio content has captions

#### 1.2.5 Audio Description (Prerecorded) (Level AA)
- Audio description provided for video content

### 1.3 Adaptable

#### 1.3.1 Info and Relationships (Level A)
- Semantic HTML used (h1-h6, lists, tables)
- ARIA landmarks for regions
- Table headers properly marked
- Form labels associated with controls

**Code Examples:**
```html
<!-- Good: Semantic headings -->
<h1>Product Details</h1>
<h2>Specifications</h2>

<!-- Good: Proper table -->
<table>
  <thead>
    <tr><th>Feature</th><th>Value</th></tr>
  </thead>
  <tbody>
    <tr><td>Weight</td><td>1.2kg</td></tr>
  </tbody>
</table>

<!-- Good: Associated label -->
<label for="email">Email</label>
<input id="email" type="email">
```

#### 1.3.2 Meaningful Sequence (Level A)
- DOM order matches visual reading order
- CSS doesn't change meaning when linearized

#### 1.3.3 Sensory Characteristics (Level A)
- Instructions don't rely solely on color, shape, size, location
- "Click the red button" → "Click the Delete button"

#### 1.3.4 Orientation (Level AA)
- Content works in both portrait and landscape
- No "rotate your device" locks

#### 1.3.5 Identify Input Purpose (Level AA)
- Autocomplete attributes on forms
- `autocomplete="email"`, `autocomplete="name"`

### 1.4 Distinguishable

#### 1.4.1 Use of Color (Level A)
- Color alone doesn't convey information
- Links distinguished by more than just color

#### 1.4.2 Audio Control (Level A)
- Auto-playing audio can be stopped/paused
- Independent volume control

#### 1.4.3 Contrast (Minimum) (Level AA)
- Normal text: 4.5:1 ratio minimum
- Large text (18pt+ or 14pt bold): 3:1 ratio

**Test Colors:**
```
#000 on #FFF = 21:1 (Pass)
#333 on #FFF = 12.6:1 (Pass)
#666 on #FFF = 5.7:1 (Pass AA, Fail AAA)
#999 on #FFF = 2.8:1 (Fail) ← Most common issue
```

#### 1.4.4 Resize Text (Level AA)
- Text readable at 200% zoom
- No content loss or functionality loss

#### 1.4.5 Images of Text (Level AA)
- Avoid images containing text
- Use real text with CSS styling

#### 1.4.10 Reflow (Level AA)
- No horizontal scroll at 320px width
- Content reflows vertically

#### 1.4.11 Non-text Contrast (Level AA)
- UI components: 3:1 contrast against adjacent colors
- Graphics: 3:1 contrast

#### 1.4.12 Text Spacing (Level AA)
- Line height: 1.5x font size
- Paragraph spacing: 2x font size
- Letter spacing: 0.12x font size
- Word spacing: 0.16x font size
- Content doesn't disappear or overlap

#### 1.4.13 Content on Hover/Focus (Level AA)
- Hover content is dismissible (Escape key)
- Hoverable (pointer can move to content)
- Persistent (remains visible until dismissed)

## Principle 2: Operable

### 2.1 Keyboard Accessible

#### 2.1.1 Keyboard (Level A)
- All functionality available via keyboard
- No mouse-only interactions

#### 2.1.2 No Keyboard Trap (Level A)
- Can navigate away from all components
- Tab or arrow keys don't get stuck

#### 2.1.4 Character Key Shortcuts (Level A)
- Single-key shortcuts can be turned off or remapped

### 2.2 Enough Time

#### 2.2.1 Timing Adjustable (Level A)
- Time limits can be extended (20 seconds warning)
- Or turned off, or adjusted up to 10x

#### 2.2.2 Pause, Stop, Hide (Level A)
- Moving/blinking content can be paused
- Auto-updating content can be controlled

### 2.3 Seizures and Physical Reactions

#### 2.3.1 Three Flashes (Level A)
- No content flashes more than 3 times per second

### 2.4 Navigable

#### 2.4.1 Bypass Blocks (Level A)
- Skip link to main content
- Skip repetitive navigation

```html
<!-- Skip link pattern -->
<a href="#main" class="skip-link">Skip to main content</a>
<nav>...</nav>
<main id="main">...</main>
```

#### 2.4.2 Page Titled (Level A)
- Descriptive, unique page titles
- `<title>` in `<head>`

#### 2.4.3 Focus Order (Level A)
- Tab order matches visual sequence
- Logical navigation flow

#### 2.4.4 Link Purpose (In Context) (Level A)
- Link text describes destination
- "Read more" → "Read more about accessibility"

#### 2.4.5 Multiple Ways (Level AA)
- Multiple ways to find pages (search, sitemap, navigation)

#### 2.4.6 Headings and Labels (Level AA)
- Descriptive headings and labels
- Accurately describe topic/purpose

#### 2.4.7 Focus Visible (Level AA)
- Keyboard focus indicator visible
- High contrast focus ring

### 2.5 Input Modalities

#### 2.5.1 Pointer Gestures (Level A)
- Multipoint gestures have single-point alternatives
- Or can be operated with single pointer

#### 2.5.2 Pointer Cancellation (Level A)
- Action on pointer up, not down
- Allows moving away to cancel

#### 2.5.3 Label in Name (Level A)
- Accessible name contains visible text
- Voice control works with visible labels

#### 2.5.4 Motion Actuation (Level A)
- Motion can be disabled
- Alternative UI controls provided

#### 2.5.7 Dragging Movements (Level AA)
- Dragging has single-pointer alternative
- Or can be operated without dragging

#### 2.5.8 Target Size (Minimum) (Level AA)
- Target size at least 24x24 CSS pixels
- Except when: inline, in sentence, essential size, or sufficient spacing

## Principle 3: Understandable

### 3.1 Readable

#### 3.1.1 Language of Page (Level A)
- Default language declared
- `<html lang="en">`

#### 3.1.2 Language of Parts (Level AA)
- Language changes marked
- `<span lang="fr">`

### 3.2 Predictable

#### 3.2.1 On Focus (Level A)
- Focus doesn't trigger context change
- No auto-submit on focus

#### 3.2.2 On Input (Level A)
- Changing form field doesn't auto-submit
- Explicit user confirmation required

#### 3.2.3 Consistent Navigation (Level AA)
- Navigation consistent across pages
- Same relative order

#### 3.2.4 Consistent Identification (Level AA)
- Components identified consistently
- Same icon = same function

### 3.3 Input Assistance

#### 3.3.1 Error Identification (Level A)
- Errors identified in text
- Sufficiently descriptive

#### 3.3.2 Labels or Instructions (Level A)
- Labels or instructions provided
- Before user input required

#### 3.3.3 Error Suggestion (Level AA)
- Suggestions for correction provided
- Unless security/content integrity risk

#### 3.3.4 Error Prevention (Legal, Financial, Data) (Level AA)
- Submissions reversible, checked, or confirmed
- For important/legal/financial data

#### 3.3.7 Redundant Entry (Level A) - New in 2.2
- Auto-populate previously entered info
- Or available for selection

#### 3.3.8 Accessible Authentication (Minimum) (Level A) - New in 2.2
- No cognitive function tests
- Alternative authentication method
- Or assistance available

## Principle 4: Robust

### 4.1 Compatible

#### 4.1.1 Parsing (Level A)
- Valid HTML markup
- No duplicate IDs
- Proper nesting

#### 4.1.2 Name, Role, Value (Level A)
- UI components have accessible name
- Role programmatically determined
- States/properties communicated

**ARIA Examples:**
```html
<!-- Custom button -->
<div role="button" tabindex="0" aria-pressed="false">
  Toggle
</div>

<!-- Expandable section -->
<button aria-expanded="false" aria-controls="details">
  Show Details
</button>
<div id="details" hidden>...</div>
```

#### 4.1.3 Status Messages (Level AA)
- Status messages announced by AT
- Use ARIA live regions

```html
<div role="status" aria-live="polite">
  Item added to cart
</div>
```

## Compliance Levels

### Level A (Minimum)
- 30 success criteria
- Must pass all
- Critical for access

### Level AA (Industry Standard)
- 20 additional criteria
- Legal requirement in many jurisdictions
- Recommended for all sites

### Level AAA (Enhanced)
- 14 additional criteria
- Optimal accessibility
- Not always achievable

## Legal Requirements by Region

| Region | Law | Level Required |
|--------|-----|----------------|
| USA Federal | Section 508 | AA |
| USA ADA | ADA Title III | AA (implied) |
| EU | EN 301 549 | AA |
| UK | Equality Act 2010 | AA |
| Canada | ACA | AA |
| Australia | DDA | AA |

## Resources

- [WCAG 2.2 Specification](https://www.w3.org/TR/WCAG22/)
- [How to Meet WCAG](https://www.w3.org/WAI/WCAG22/quickref/)
- [Understanding WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
