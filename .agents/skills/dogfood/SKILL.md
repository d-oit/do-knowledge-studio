---
name: dogfood
version: "1.0.0"
category: quality
description: Systematically explore and test a web application to find bugs, UX issues, and other problems. Use when asked to "dogfood", "QA", "exploratory test", "find issues", "bug hunt", "test this app/site/platform", or review the quality of a web application. Produces a structured report with full reproduction evidence.
---

# Dogfood

Systematically explore a web application, find issues, and produce a report with full reproduction evidence for every finding.

## Setup

Only the **Target URL** is required. Everything else has sensible defaults -- use them unless the user explicitly provides an override.

| Parameter | Default | Example override |
|-----------|---------|-----------------|
| **Target URL** | _(required)_ | `vercel.com`, `http://localhost:3000` |
| **Session name** | Slugified domain (e.g., `vercel.com` -> `vercel-com`) | `--session my-session` |
| **Output directory** | `./dogfood-output/` | `Output directory: /tmp/qa` |
| **Scope** | Full app | `Focus on the billing page` |
| **Authentication** | None | `Sign in to user@example.com` |

If the user says something like "dogfood vercel.com", start immediately with defaults. Do not ask clarifying questions unless authentication is mentioned but credentials are missing.

Always use `agent-browser` directly -- never `npx agent-browser`. The direct binary uses the fast Rust client. `npx` routes through Node.js and is significantly slower.

## Workflow

```
1. Initialize      Set up session, output dirs, report file
2. Authenticate    Sign in if needed, save state
3. Orient          Navigate to starting point, take initial snapshot
4. Explore         Systematically visit pages and test features
5. Document        Screenshot + record each issue as found
6. Wrap up         Update summary counts, close session
```

### 1. Initialize

```bash
mkdir -p {OUTPUT_DIR}/screenshots {OUTPUT_DIR}/videos
```

Start a named session:

```bash
agent-browser --session {SESSION} open {TARGET_URL}
agent-browser --session {SESSION} wait --load networkidle
```

### 2. Authenticate

If the app requires login:

```bash
agent-browser --session {SESSION} snapshot -i
# Identify login form refs, fill credentials
agent-browser --session {SESSION} fill @e1 "{EMAIL}"
agent-browser --session {SESSION} fill @e2 "{PASSWORD}"
agent-browser --session {SESSION} click @e3
agent-browser --session {SESSION} wait --load networkidle
```

For OTP/email codes: ask the user, wait for their response, then enter the code.

After successful login, save state for potential reuse:

```bash
agent-browser --session {SESSION} state save {OUTPUT_DIR}/auth-state.json
```

### 3. Orient

Take an initial annotated screenshot and snapshot to understand the app structure:

```bash
agent-browser --session {SESSION} screenshot --annotate {OUTPUT_DIR}/screenshots/initial.png
agent-browser --session {SESSION} snapshot -i
```

Identify the main navigation elements and map out the sections to visit.

### 4. Explore

**Strategy -- work through the app systematically:**
- Start from the main navigation. Visit each top-level section.
- Within each section, test interactive elements: click buttons, fill forms, open dropdowns/modals.
- Check edge cases: empty states, error handling, boundary inputs.
- Try realistic end-to-end workflows (create, edit, delete flows).
- Check the browser console for errors periodically.

**At each page:**

```bash
agent-browser --session {SESSION} snapshot -i
agent-browser --session {SESSION} screenshot --annotate {OUTPUT_DIR}/screenshots/{page-name}.png
agent-browser --session {SESSION} errors
agent-browser --session {SESSION} console
```

Use your judgment on how deep to go. Spend more time on core features and less on peripheral pages.

### 5. Document Issues (Repro-First)

Every issue must be reproducible. When you find something wrong, stop exploring and document it immediately.

**For interactive issues (functional, UX, console errors on action):**
1. Start a repro video: `agent-browser --session {SESSION} record start {OUTPUT_DIR}/videos/issue-{NNN}-repro.webm`
2. Walk through steps at human pace with screenshots between actions
3. Capture the broken state with annotated screenshot
4. Stop video and write numbered repro steps in report

**For static issues (typos, clipped text, visual glitches on load):**
- Single annotated screenshot is sufficient. No video needed.

### 6. Wrap Up

Aim to find **5-10 well-documented issues**, then wrap up. Depth of evidence matters more than total count.

1. Re-read the report and update summary severity counts
2. Close the session: `agent-browser --session {SESSION} close`
3. Tell the user the report is ready with summary

## Guidance

- **Repro is everything.** Every issue needs proof matched to its type.
- **Verify before collecting evidence.** Retry at least once to confirm reproducibility.
- **Use the right snapshot:** `snapshot -i` for interactive elements, `snapshot` for reading content.
- **Never delete output files** mid-session. Work forward, not backward.
- **Never read the target app's source code.** All findings must come from browser observation.
- **Check the console.** Many issues are invisible in the UI but show as JS errors.

## References
- `references/issue-taxonomy.md` - What to look for, severity levels, exploration checklist
- `templates/dogfood-report-template.md` - Copy into output directory as the report file
