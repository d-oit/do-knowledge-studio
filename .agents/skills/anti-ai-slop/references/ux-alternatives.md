# UX Alternatives — Flow by Flow

## Onboarding

### Instead of: Welcome modal → 5-step wizard → confetti

**Blank slate onboarding:**
Show the product empty. Make the empty state the CTA. "Create your first [thing]" IS the onboarding.

**Contextual hints:**
Surface guidance exactly when a user hits a wall. Not upfront, not a tour. Just-in-time.

**Sample data onboarding:**
Load the product with realistic sample data. Let users explore a working version before committing. "This is a sample workspace — [start with your own data]"

**Job-based onboarding:**
Ask one question: "What are you trying to do first?" Route to the relevant feature immediately. Skip everything else.

**Zero-friction start:**
Let users USE the product before creating an account. Gate the save, not the exploration.

---

## Authentication

### Instead of: Email + password form → verify email → set up profile → onboarding wizard

**Magic link flow:**
Email only → click link → done. No password to forget.

**SSO first:**
"Continue with Google / GitHub / Microsoft" as primary options. Password as fallback.

**Progressive account creation:**
Let users work anonymously. Prompt to save only when they've created something worth saving. "Create an account to save your work" — after they've made something.

---

## Destructive Actions

### Instead of: "Are you sure?" confirmation modal

**Undo pattern:**
Execute immediately. Show a toast with an undo action for 5–10 seconds. Way less friction, same safety.

**Soft delete:**
Move to trash. Let users recover for 30 days. No confirmation needed upfront.

**Named confirmation:**
If confirmation IS needed (truly irreversible), require the user to type the item name. "Type 'Production DB' to confirm deletion." More friction where it's warranted.

---

## Search

### Instead of: Exact-match search → "No results found" dead end

**Fuzzy search:**
Tolerate typos. Use Levenshtein distance or a library like Fuse.js.

**Faceted results:**
When results are sparse, show filter options to help users refine instead of hitting a wall.

**Fallback suggestions:**
"No results for 'receit' — did you mean 'receipt'?" Always give a next step.

**Search as you type:**
Results appear live. No submit button needed for most queries.

---

## Forms

### Instead of: 8-field signup form

**Progressive disclosure:**
Start with one or two fields. Reveal more as context accumulates.

**Field order by cognitive load:**
Easy fields first (name). Hard fields last (billing). Never put credit card before you've shown value.

**Inline validation:**
Validate on blur, not on submit. Don't make users fill out the whole form then tell them field 2 was wrong.

**Smart defaults:**
Pre-fill what you can infer (country from IP, name from OAuth). Only ask what you genuinely need.

---

## Navigation

### Instead of: Hamburger on desktop, hidden nav

**Persistent sidebar:**
For apps with multiple sections, always show the nav. Don't hide it.

**Breadcrumbs for deep hierarchies:**
Show the path. Let users jump back anywhere.

**Command palette (⌘K):**
Power users skip nav entirely. A searchable command palette is faster than any nav structure.

**Progressive navigation:**
Surface the most common actions at the top level. Bury edge cases. Don't flatten everything.

---

## Error States

### Instead of: Generic error page with "Something went wrong"

**Tell them what failed:**
"Your payment didn't go through — the card was declined."

**Tell them what to do:**
"Try a different card or [contact your bank]."

**Preserve their work:**
If a form submission fails, don't clear the form. Keep all their input.

**Offer an exit:**
"If this keeps happening, [email us]" with a real address, not a form.

---

## Notifications

### Instead of: Toast for every action

**Silence successful, expected actions.** Save doesn't need a toast. It should just save.

**Inline feedback near the action.** A checkmark appears next to the save button. Not a floating toast.

**Reserve toasts for async results.** "Your export is ready — [download]" makes sense as a toast. "Saved" doesn't.

**Notification center for less urgent.** Background jobs, team activity, system messages — collect and surface in a notification inbox, not a stream of toasts.
