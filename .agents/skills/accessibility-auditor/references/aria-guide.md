# ARIA Authoring Practices Guide

Comprehensive guide for implementing Accessible Rich Internet Applications (ARIA).

## ARIA Fundamentals

### First Rule of ARIA
> No ARIA is better than bad ARIA.

Use native HTML elements when available:
- `<button>` instead of `role="button"`
- `<input type="checkbox">` instead of `role="checkbox"`
- `<nav>` instead of `role="navigation"`
- `<main>` instead of `role="main"`

### ARIA Attributes Categories

1. **Roles** - Define what an element is
2. **Properties** - Describe characteristics (rarely change)
3. **States** - Describe current condition (frequently change)

## Common Design Patterns

### Button

```html
<!-- Native (preferred) -->
<button type="button">Save</button>

<!-- Custom button with ARIA -->
<div role="button"
     tabindex="0"
     aria-pressed="false"
     onkeydown="handleKey(event)">
  Toggle
</div>

<script>
function handleKey(e) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    toggle();
  }
}
</script>
```

**Requirements:**
- `role="button"`
- `tabindex="0"` (focusable)
- Keyboard handlers (Enter, Space)
- Visual focus indicator

### Modal Dialog

```html
<div role="dialog"
     aria-modal="true"
     aria-labelledby="dialog-title"
     aria-describedby="dialog-desc">
  <h2 id="dialog-title">Confirm Action</h2>
  <p id="dialog-desc">This will delete your account.</p>
  <button>Cancel</button>
  <button>Delete</button>
</div>
```

**Requirements:**
- `role="dialog"`
- `aria-modal="true"`
- `aria-labelledby` (title reference)
- Focus trap inside dialog
- Escape key closes
- Return focus to trigger on close

### Accordion

```html
<div class="accordion">
  <h3>
    <button aria-expanded="false"
            aria-controls="section1">
      Section 1
    </button>
  </h3>
  <div id="section1" hidden>
    <p>Content...</p>
  </div>
</div>
```

**Requirements:**
- Button controls the panel
- `aria-expanded` toggles
- `aria-controls` references panel
- `hidden` attribute on panel

### Tabs

```html
<div class="tabs">
  <div role="tablist" aria-label="Product Info">
    <button role="tab"
            aria-selected="true"
            aria-controls="panel-1"
            id="tab-1">
      Details
    </button>
    <button role="tab"
            aria-selected="false"
            aria-controls="panel-2"
            id="tab-2"
            tabindex="-1">
      Reviews
    </button>
  </div>
  
  <div role="tabpanel"
       id="panel-1"
       aria-labelledby="tab-1">
    <p>Product details content...</p>
  </div>
  <div role="tabpanel"
       id="panel-2"
       aria-labelledby="tab-2"
       hidden>
    <p>Reviews content...</p>
  </div>
</div>
```

**Keyboard Interaction:**
- Tab: Move focus into tablist
- Arrow keys: Navigate between tabs
- Home: First tab
- End: Last tab
- Enter/Space: Activate focused tab

### Menu Button

```html
<button aria-haspopup="true"
        aria-expanded="false"
        aria-controls="menu">
  Actions
</button>
<ul role="menu"
    id="menu"
    hidden>
  <li role="menuitem">Edit</li>
  <li role="menuitem">Delete</li>
  <li role="menuitem">Share</li>
</ul>
```

### Alert and Alert Dialog

```html
<!-- Alert (non-modal, non-blocking) -->
<div role="alert">
  Item saved successfully
</div>

<!-- Alert Dialog (modal, blocking) -->
<div role="alertdialog"
     aria-modal="true"
     aria-labelledby="alert-title">
  <h2 id="alert-title">Session Expiring</h2>
  <p>Your session expires in 2 minutes.</p>
  <button>Continue Session</button>
</div>
```

### Live Regions

```html
<!-- Polite: Announced when user idle -->
<div role="status" aria-live="polite">
  Item added to cart
</div>

<!-- Assertive: Interrupts current speech -->
<div role="alert" aria-live="assertive">
  Form submission failed
</div>
```

## ARIA Roles Reference

### Landmark Roles

| Role | Usage | Native Equivalent |
|------|-------|-------------------|
| `banner` | Site header | `<header>` |
| `complementary` | Sidebar | `<aside>` |
| `contentinfo` | Footer | `<footer>` |
| `form` | Form region | `<form>` |
| `main` | Main content | `<main>` |
| `navigation` | Nav links | `<nav>` |
| `region` | Generic section | `<section>` |
| `search` | Search area | None |

### Widget Roles

| Role | Description |
|------|-------------|
| `button` | Clickable action |
| `checkbox` | Checked/unchecked |
| `dialog` | Modal dialog |
| `link` | Navigation |
| `menu` | List of choices |
| `menuitem` | Menu item |
| `progressbar` | Progress indicator |
| `radio` | Single selection |
| `slider` | Range input |
| `tab` | Tab control |
| `tabpanel` | Tab content |
| `textbox` | Text input |
| `tooltip` | Contextual help |
| `tree` | Collapsible list |

### Document Structure

| Role | Usage |
|------|-------|
| `article` | Self-contained composition |
| `group` | Set of related objects |
| `list` | Group of list items |
| `listitem` | List entry |
| `separator` | Divider |
| `table` | Data table |

## ARIA States and Properties

### Common States

| State | Values | Usage |
|-------|--------|-------|
| `aria-checked` | true/false/mixed | Checkable items |
| `aria-disabled` | true/false | Non-interactive |
| `aria-expanded` | true/false | Expandable content |
| `aria-hidden` | true/false | Excluded from AT |
| `aria-pressed` | true/false/mixed | Toggle buttons |
| `aria-selected` | true/false | Selected option |

### Common Properties

| Property | Usage |
|----------|-------|
| `aria-controls` | ID of controlled element |
| `aria-describedby` | ID of description element |
| `aria-label` | Text label |
| `aria-labelledby` | ID of label element |
| `aria-live` | Live region priority |
| `aria-haspopup` | Has popup (menu/dialog) |
| `aria-modal` | Modal dialog |

### Relationships

```html
<!-- Label association -->
<button aria-labelledby="save-label">
  <span id="save-label">Save Document</span>
  <span>Ctrl+S</span>
</button>

<!-- Description -->
<button aria-describedby="save-help">
  Save
</button>
<p id="save-help">Saves to cloud storage</p>

<!-- Controls relationship -->
<button aria-controls="details" aria-expanded="false">
  Show Details
</button>
<div id="details" hidden>...</div>
```

## Focus Management

### Focusable Elements

Naturally focusable:
- `<a>` with href
- `<button>`
- `<input>`, `<select>`, `<textarea>`
- `<details>`
- `contenteditable`
- `tabindex="0"` elements

### Tabindex Values

| Value | Behavior |
|-------|----------|
| Negative | Focusable programmatically, not in tab order |
| 0 | In tab order (after natural focusables) |
| Positive | In tab order at specific position (avoid) |

```html
<!-- Focus trap inside modal -->
<div role="dialog" class="modal">
  <button>First focusable</button>
  <!-- other content -->
  <button>Last focusable</button>
</div>

<script>
// Tab cycles within modal
modal.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  }
});
</script>
```

### Focus Indicators

```css
/* Minimum focus visibility */
:focus {
  outline: 2px solid #005fcc;
  outline-offset: 2px;
}

/* High contrast mode support */
@media (forced-colors: active) {
  :focus {
    outline: 2px solid CanvasText;
  }
}
```

## Testing with Screen Readers

### NVDA (Windows)
- Free, popular
- Insert key = NVDA modifier
- Insert + Space = Forms mode toggle
- Insert + F7 = Element list

### VoiceOver (macOS)
- Built-in, free
- Cmd + F5 = Toggle
- Ctrl + Option = VO modifier
- VO + U = Rotor (element navigation)

### JAWS (Windows)
- Commercial
- Insert key = JAWS modifier
- Insert + F3 = Virtual HTML features
- Insert + F5 = Form field list

### Common Commands

| Action | NVDA | VoiceOver | JAWS |
|--------|------|-----------|------|
| Read all | Insert + ↓ | VO + A | Insert + ↓ |
| Next heading | H | VO + Cmd + H | H |
| Next link | K | VO + Cmd + L | Tab (links) |
| Next form | F | VO + Cmd + J | F |
| Element list | Insert + F7 | VO + U | Insert + F3 |

## ARIA Validation

### Common Mistakes

1. **Redundant roles**
   ```html
   <!-- Bad: Redundant -->
   <nav role="navigation">...</nav>
   
   <!-- Good: Native only -->
   <nav>...</nav>
   ```

2. **Missing labels**
   ```html
   <!-- Bad: No accessible name -->
   <div role="button">×</div>
   
   <!-- Good: Accessible name -->
   <div role="button" aria-label="Close">×</div>
   ```

3. **Invalid combinations**
   ```html
   <!-- Bad: Button can't contain interactive -->
   <div role="button">
     <a href="...">Link</a>
   </div>
   ```

4. **Missing states**
   ```html
   <!-- Bad: No expanded state -->
   <button>Show Details</button>
   
   <!-- Good: State communicated -->
   <button aria-expanded="false" aria-controls="details">
     Show Details
   </button>
   ```

### Validation Tools

- **W3C ARIA Validator**: validator.w3.org/nu/
- **axe DevTools**: Browser extension
- **Chrome DevTools**: Accessibility panel
- **Firefox Accessibility Inspector**: Built-in

## Resources

- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [ARIA Specification](https://www.w3.org/TR/wai-aria/)
- [Accessible Name Calculation](https://www.w3.org/TR/accname/)
