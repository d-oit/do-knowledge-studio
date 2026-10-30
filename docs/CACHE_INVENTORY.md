# PWA Cache Storage Inventory & Policy

## Overview
DO Knowledge Studio uses a Progressive Web App (PWA) Service Worker (`public/sw.js`) to provide offline support for the static application shell and selected safe same-origin API endpoints.

As a privacy-first, local-first knowledge workspace, the application strictly prevents authenticated, personalized, AI provider, or non-idempotent network responses from being stored in shared `CacheStorage`.

---

## Active Cache Storage Inventory

| Cache Key | Scope & Strategy | Contents | Lifecycle / Purge Trigger |
| :--- | :--- | :--- | :--- |
| `dks-static-v6` | App Shell (Cache-First) | JS/CSS bundles, HTML entry point, fonts, static icons, precached manifest assets (`/precache-manifest.json`) | Retained across active sessions. Purged during service worker `activate` when cache key version is incremented. |
| `dks-api-v2` | Same-Origin Safe APIs (Network-First) | Explicit same-origin allowlisted GET/HEAD responses (`/api`) | Retained across active sessions. Purged during service worker `activate` when cache key version is incremented or on user cache clear. |

---

## Cacheability & Privacy Rules

### 1. HTTP Methods
- **Allowed**: `GET`, `HEAD`
- **Blocked**: `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`
- Non-idempotent requests are passed directly to the network via `fetch(request)` and are **never** stored or replayed by the service worker.

### 2. Request Header Exclusions
A request is bypassed and **never cached** if it carries any of the following:
- `Authorization` header
- `Cookie` header
- `Cache-Control` header containing `no-store` or `no-cache`
- `Pragma` header containing `no-cache`

### 3. Response Header Exclusions
A response is rejected and **never written to CacheStorage** if:
- HTTP status is not successful (`200-299`)
- `Cache-Control` header contains `private` or `no-store`

### 4. Same-Origin API Allowlist
- **Allowlisted Path**: `/api` (exact root match or normalized)
- **Excluded Endpoints & Services**:
  - AI Provider calls (`/api/chat`, OpenRouter, Ollama, local models)
  - Web research proxy requests
  - WebRTC room / signaling traffic (`y-webrtc`)
  - External origins and cross-origin endpoints

---

## User-Visible Cache Management
Users can manually clear all PWA cache storage containers at any time via the UI:
1. Navigate to **Export / Backup** view (`ExportView`).
2. Click **Clear offline cache**.
3. Confirm in the modal dialog. All `CacheStorage` instances are purged via `clearAppCaches()`.
