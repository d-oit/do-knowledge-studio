# Plan 10: Implementation Audit & Gap Analysis

**Date**: 2026-05-07  
**Status**: ACTIVE  
**Goal**: Identify and track implementation gaps where backend logic exists but UI/Frontend is missing, or where implementation is partial.

## Summary of Findings

| Feature | Logic (Repo/Lib) | UI (React) | Status |
|---------|------------------|------------|--------|
| **Entity CRUD** | ✅ Complete | ✅ Complete | Done |
| **Claim Provenance** | ✅ Complete | ✅ Complete | Done |
| **Graph Snapshots** | ✅ Complete | ✅ Complete | Done |
| **Export** | ✅ Complete | ✅ Complete | Done |
| **AI Harness** | ✅ Complete | ✅ Complete | Done |
| **Search (Orama)** | ✅ Complete | ✅ Complete | Done |
| **CLI Persistence** | ✅ Complete | N/A | Done |

## Detailed Gaps

### 10.1 Wire Up Graph Snapshots
- **Location**: `src/features/graph/GraphView.tsx`
- **Gap**: `GraphControls` is called without `onSaveSnapshot`.
- **Action**: 
    1. Pass `filteredData.entities` as `nodes` and `filteredData.links` as `edges` to `GraphControls`.
    2. Implement `handleSaveSnapshot` in `GraphView` using `repository.createSnapshot`.
    3. Add a "Snapshot History" sidebar to view/restore snapshots.

### 10.2 Claim Provenance UI
- **Location**: `src/features/editor/`
- **Gap**: `Repository` supports `verification_status` and `source`, but TipTap editor doesn't show them.
- **Action**:
    1. Update `ClaimExtension.ts` to support metadata.
    2. Add a bubble menu or sidebar for claims to edit provenance data.

### 10.3 Real Export in UI
- **Location**: `src/features/export/ExportPanel.tsx`
- **Gap**: Uses mock `setTimeout`.
- **Action**:
    1. Implement Web-native exports using OPFS or `File System Access API`.
    2. Port logic from `cli/index.ts` to browser-compatible version.

### 10.4 AI Harness Connection
- **Location**: `src/features/ai/AIHarness.tsx`
- **Gap**: Completely non-functional.
- **Action**:
    1. Use `src/lib/llm/` system to send messages.
    2. Add context augmentation from Orama.

### 10.5 CLI Version & Persistence
- **Location**: `cli/index.ts`, `src/db/client.ts`
- **Gap**: Version is `0.1.0` (should be `0.2.4`). Persistence in Node needs verification.
- **Action**:
    1. Bump version to `0.2.4`.
    2. Verify `sqlite-wasm` persistence on disk in Node environment.
