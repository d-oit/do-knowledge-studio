## LESSON-037: Autosave plus a validating schema silently discards every
half-typed value

**Date**: 2026-09-26
**Component**: AI Harness / settings persistence
**Severity**: Medium

**What happened**: The AI Harness settings panel autosaves on every state
change, and `StoredSettingsSchema` rejects a base URL that does not parse.
Typing a base URL character by character therefore fired a *failing* save on
most keystrokes (`h`, `ht`, `http:`, `http:/`, `http://`, …). Each partial host
was rejected, the stored record kept the last good value, and the field
appeared editable while discarding the edit. One typing session produced 164
`Failed to save AI settings: Invalid AI settings schema` errors — and the user
saw no error at all, because the failures were logged and swallowed.

This was pre-existing on the Ollama base URL field; it would have shipped with
the new Jev field too.

**Why it is easy to miss**:

- The *final* value is valid, so the last save succeeds and the persisted record
  looks correct when inspected afterwards. Only the intermediate keystrokes
  fail, and nobody reads the console during typing.
- A test that sets the whole value in one `fireEvent.change` never reproduces
  it; the bug only exists in the per-keystroke sequence.
- The failure mode is a *rejected write*, not a crash, so nothing surfaces in
  the UI.

**Prevention**:

- Text inputs that autosave and are also schema-validated must keep a local
  draft and commit on blur (or Enter), not on every change. `BaseUrlInput` in
  `ai-harness-settings-panel.tsx` is the pattern: validate, then commit the
  *normalized* value; on rejection leave storage untouched and set
  `aria-invalid` on the field.
- When a change touches a persisted schema, drive the real UI: type a value
  keystroke by keystroke and read the console. A passing unit suite is not
  evidence that autosave works.
- Count console errors as a smoke-test assertion, not just as noise. "164
  errors" was the only signal that the persisted value was at risk.

**Tags**: #ai #settings #persistence #zod #autosave #ssrf #ui
