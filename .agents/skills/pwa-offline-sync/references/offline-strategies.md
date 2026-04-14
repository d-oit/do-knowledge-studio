# Offline-First Strategies

Offline-first architecture patterns for PWAs.

## Cache Strategies
- **Cache-first**: Static assets, shells
- **Network-first**: Dynamic data, API responses
- **Stale-while-revalidate**: Content that updates periodically

## Sync Queue Design
- Queue writes locally when offline
- Deduplicate via mutation IDs
- Replay on reconnect with exponential backoff
- Handle conflicts with last-write-wins or server-wins
