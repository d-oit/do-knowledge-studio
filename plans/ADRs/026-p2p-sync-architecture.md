# ADR 026: P2P Sync Architecture

**Date**: 2026-07-17  
**Status**: Accepted  
**Related**: Plan 064, Issues #450-#460, ADR 018 (local-first), ADR 025 (AI provider)

## Context

Phase 8 introduces collaboration features: P2P sync, multi-user presence, and voice-to-knowledge. The app is local-first (Zustand + localStorage, no backend). Sync must extend this without introducing a required server.

Current data model:
- `Entity` — id, name, type, description, content, tags, links, timestamps
- `Claim` — id, entityId, statement, evidence, confidence, verification, source
- `ChatMessage` — id, role, content, citations, timestamp

All stored in Zustand, persisted to localStorage via `zustand/persist`.

## Decision

### 1. CRDT Library: Yjs

**Choose Yjs over Automerge.**

| Factor | Yjs | Automerge |
|--------|-----|-----------|
| Bundle size | ~30 KB gzipped | ~120 KB gzipped |
| Performance | Fastest CRDT benchmark | Slower (columnar store) |
| Tiptap integration | Official `@tiptap/extension-collaboration` | No official integration |
| WebRTC provider | `y-webrtc` (built-in) | Manual implementation |
| Persistence | `y-indexdb`, `y-leveldb` | Built-in |
| Ecosystem | Rich (editors, providers, persistence) | Smaller |
| Merge guarantees | Last-writer-wins per key, array/Map CRDT | Op-based, richer merge semantics |

Yjs is the better fit because:
- **Bundle size**: 90 KB smaller matters for a client-side-only app
- **Tiptap**: Already uses Tiptap for the editor; Yjs has official Tiptap integration
- **WebRTC**: `y-webrtc` handles peer discovery and signaling out of the box
- **Performance**: Critical for large knowledge bases (500+ entities)

Trade-off: Automerge has richer merge semantics for nested structures. Yjs uses last-writer-wins per key, which is acceptable for our flat Entity/Claim model where conflicts are rare and resolution is straightforward.

### 2. Transport: WebRTC via y-webrtc

**Browser-native P2P, no signaling server required.**

- `y-webrtc` uses a public signaling server (or self-hosted) for initial peer discovery
- Once connected, data flows peer-to-peer via WebRTC data channels
- Fallback: manual signaling via QR code exchange (offline-first)

Signaling options:
| Option | Pros | Cons |
|--------|------|------|
| `y-webrtc` default signaling | Zero config, works immediately | Depends on public server for discovery |
| Manual QR code exchange | No server dependency at all | Requires both peers online simultaneously |
| Both (recommended) | Best of both worlds | Slightly more code |

**Decision**: Support both. Default to `y-webrtc` signaling (zero config). Add QR code pairing as an explicit "offline pairing" mode.

### 3. Data Model: Yjs Doc per Collection

Map the existing data model to Yjs shared types:

```typescript
// Yjs document structure
interface SyncDoc {
  entities: Y.Map<Y.Map<unknown>>   // Y.Map<entityId> → Y.Map<entity fields>
  claims: Y.Map<Y.Map<unknown>>     // Y.Map<claimId> → Y.Map<claim fields>
  meta: Y.Map<unknown>              // sync metadata (device ID, timestamps)
}
```

Each entity/claim is a `Y.Map` with typed fields. This gives us:
- **Per-field CRDT merge**: Changing `entity.name` on device A and `entity.description` on device B merges cleanly
- **Last-writer-wins per field**: Acceptable for our use case (rare concurrent edits to the same field)
- **Observable changes**: Yjs fires events on every change, enabling reactive UI updates

### 4. Sync Protocol: Delta-Based

```
Device A                          Device B
  │                                 │
  │──── full state (on connect) ───>│
  │                                 │
  │<─── delta (local changes) ─────│
  │                                 │
  │──── delta (local changes) ────>│
  │                                 │
  │     (periodic delta exchange)   │
```

- **On connect**: Exchange full Yjs state (`Y.encodeStateAsUpdate`)
- **Ongoing**: Exchange deltas (`Y.encodeStateAsUpdate(doc, peerState)`)
- **Conflict resolution**: Yjs CRDT handles automatically (last-writer-wins per key)
- **Offline**: Changes queue locally, sync when peers reconnect

### 5. Persistence: Dual-Layer

```
Yjs Doc (in-memory)
  │
  ├── y-indexdb (IndexedDB)    ← persistent across reloads
  │
  └── Zustand localStorage     ← existing persistence (read-only bridge)
```

- **Primary**: `y-indexdb` persists the Yjs document to IndexedDB (survives tab close, works offline)
- **Bridge**: On load, hydrate Zustand store from Yjs doc. On Yjs change, update Zustand.
- **Migration**: On first sync, merge existing localStorage data into Yjs doc, then mark localStorage as synced.

### 6. Device Identity

Each device generates a persistent ID stored in localStorage:

```typescript
interface DeviceMeta {
  deviceId: string        // crypto.randomUUID(), persisted
  deviceName: string      // user-editable (e.g. "Laptop", "Phone")
  lastSeen: number        // Date.now()
}
```

Device IDs are used for:
- Attributing changes ("edited by Device A")
- Conflict resolution tie-breaking (lower deviceId wins)
- Presence tracking

### 7. Signaling & Pairing

**QR Code Pairing Flow:**
1. Device A generates a QR code containing its WebRTC offer (base64-encoded SDP)
2. Device B scans the QR code (camera or manual paste)
3. Device B generates an answer and displays it as a QR code
4. Device A scans/pastes the answer
5. WebRTC connection established, sync begins

Implementation: Use `qrcode` library for generation, browser camera API for scanning.

## Consequences

### Positive
- True P2P sync with no server dependency
- Offline-first: works without network, syncs when peers reconnect
- Tiptap integration enables real-time collaborative editing later
- Yjs is battle-tested (used by dozens of production apps)
- Bundle size stays small (~30 KB gzipped for Yjs)

### Negative
- Yjs last-writer-wins per field may lose rare concurrent edits to the same field
- WebRTC requires both peers to be online simultaneously for initial connection
- QR code pairing is slower than automatic discovery
- No built-in access control (anyone with the QR code can connect)

### Neutral
- Zustand store becomes a read-only view of the Yjs doc (existing code reads unchanged)
- Chat messages sync but are not CRDT-merged (append-only, no conflicts)
- Voice-to-knowledge (Epic 4) is independent and can parallel

## Migration

1. Install `yjs`, `y-webrtc`, `y-indexdb`
2. Create `src/lib/sync/` module with Yjs doc management
3. Bridge Zustand ↔ Yjs (bidirectional sync)
4. Add QR code pairing UI
5. Migrate existing localStorage data into Yjs doc on first load

## Alternatives Considered

1. **Automerge** — Rejected: larger bundle, no Tiptap integration, slower benchmarks
2. **Custom CRDT** — Rejected: too complex, Yjs is battle-tested
3. **WebSocket + central server** — Rejected: violates local-first (ADR 018)
4. **IPFS** — Rejected: too heavy for browser, requires daemon
5. **Fireproof** — Rejected: newer, smaller ecosystem, less proven
6. **RxDB + CRDT plugin** — Rejected: heavier, more opinionated, less P2P-friendly
