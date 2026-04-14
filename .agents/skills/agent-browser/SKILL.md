---
name: agent-browser
version: "1.0.0"
category: workflow
description: Browser automation CLI for AI agents. Use when the user needs to interact with websites, including navigating pages, filling forms, clicking buttons, taking screenshots, extracting data, testing web apps, or automating any browser task. Triggers include requests to "open a website", "fill out a form", "click a button", "take a screenshot", "scrape data from a page", "test this web app", "login to a site", "automate browser actions", or any task requiring programmatic web interaction.
---

# Browser Automation with agent-browser

The CLI uses Chrome/Chromium via CDP. Install via `npm i -g agent-browser` or `brew install agent-browser`. Run `agent-browser install` to download Chrome.

## Core Workflow
1. **Navigate**: `agent-browser open <url>`
2. **Snapshot**: `agent-browser snapshot -i` (get element refs like `@e1`, `@e2`)
3. **Interact**: Use refs to click, fill, select
4. **Re-snapshot**: After navigation or DOM changes, get fresh refs

```bash
agent-browser open https://example.com/form
agent-browser snapshot -i
# Output: @e1 [input type="email"], @e2 [input type="password"], @e3 [button] "Submit"
agent-browser fill @e1 "user@example.com"
agent-browser fill @e2 "password123"
agent-browser click @e3
agent-browser wait 2000
agent-browser snapshot -i # Check result
```

## Essential Patterns

**Command chaining** (use `&&` for efficiency):
```bash
agent-browser batch "open https://example.com" "snapshot -i"
agent-browser batch "click @e1" "wait 1000" "screenshot"
```

**Data extraction**:
```bash
agent-browser get text @e5
agent-browser snapshot -i --json # For parsing
```

**Screenshots**:
```bash
agent-browser screenshot # Basic screenshot
agent-browser screenshot --annotate # With numbered element labels
```

**Session management** (always close when done):
```bash
agent-browser --session my-session open https://example.com
agent-browser --session my-session close
```

## Critical Rules
- **Refs (`@e1`, `@e2`) are invalidated after navigation** - always re-snapshot
- **Avoid `wait --load networkidle`** on sites with analytics/websockets - use `wait 2000` instead
- **Always close sessions** to prevent leaked processes
- Use `agent-browser batch` for 2+ sequential commands

## Common Issues
- **Commands timeout?** Check for pending dialogs: `agent-browser dialog status`
- **Need visual verification?** Use `screenshot --annotate` for labeled elements
- **Complex JS eval?** Use `eval --stdin <<'EVALEOF'` to avoid shell escaping

## References
- `references/commands.md` - Complete command reference
- `references/patterns.md` - Authentication, iframes, devices, security
- `references/troubleshooting.md` - Timeouts, dialogs, sessions, ref lifecycle
