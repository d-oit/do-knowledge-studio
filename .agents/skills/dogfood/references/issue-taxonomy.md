# Dogfood Issue Taxonomy

## Issue Types and Severity

### Functional Bugs (Critical/High)
- Broken links or navigation
- Form submission failures
- Error states not handled
- Data loss on refresh

### UX Issues (Medium/High)
- Confusing workflow
- Missing feedback on actions
- Poor empty states
- Inconsistent navigation

### Visual Issues (Low/Medium)
- Text clipping or overflow
- Misaligned elements
- Placeholder text in production
- Broken images

### Console Errors (Medium)
- JavaScript errors on load
- Failed network requests
- Unhandled promise rejections

## Exploration Checklist

- [ ] Main navigation works
- [ ] All top-level pages load
- [ ] Forms accept valid input
- [ ] Forms reject invalid input gracefully
- [ ] Empty states display correctly
- [ ] Error states display correctly
- [ ] Create/Edit/Delete flows work
- [ ] No console errors on navigation
- [ ] Responsive at mobile/tablet/desktop sizes
