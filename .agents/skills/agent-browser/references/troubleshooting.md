# Agent Browser Troubleshooting

## Common Issues

### Timeouts
- Check for pending dialogs: `agent-browser dialog status`
- Avoid `wait --load networkidle` on sites with analytics

### Session Leaks
- Always close sessions: `agent-browser --session <name> close`
- Use named sessions for long-running workflows

### Ref Lifecycle
- Refs (`@e1`, `@e2`) invalidated after navigation
- Always re-snapshot after DOM changes
