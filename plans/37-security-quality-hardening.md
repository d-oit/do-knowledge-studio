# Plan 37: Security & Quality Hardening

**GOAP Goal**: G-SECURITY-V2  
**Priority**: P1 (Security concerns from swarm analysis)  
**Estimated Total Effort**: 8-12 hours  
**Source**: `analysis/SWARM_ANALYSIS.md` — Security & Quality perspective  
**Date**: 2026-05-31

## Issue Summary

| ID | Issue | Priority | Effort |
|----|-------|----------|--------|
| S-01 | API keys in plaintext localStorage | High | 3-4h |
| S-02 | SSRF in URL resolution | Medium | 1-2h |
| S-03 | Client-side rate limiting bypass | Medium | 1-2h |
| S-04 | No URL scheme validation | Medium | 0.5h |
| IM-1 | Browser migration fallback only loads first file | High | 1h |
| IM-2 | Snapshot JSON parse without validation | High | 1h |
| Q-03 | 14 silent catch blocks | Medium | 1-2h |

## Tasks

### 37.1 Encrypt API Keys at Rest (HIGH)
**Files**: `src/lib/llm/config.ts`, `src/lib/llm/encryption.ts` (new)  
**Action**:

1. Create `src/lib/llm/encryption.ts`:
   ```typescript
   const ENCRYPTION_KEY = 'dks-llm-encryption-key';
   
   async function getKey(): Promise<CryptoKey> {
     const stored = localStorage.getItem(ENCRYPTION_KEY);
     if (stored) {
       return crypto.subtle.importKey('jwk', JSON.parse(stored), 
         { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
     }
     const key = await crypto.subtle.generateKey(
       { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
     const exported = await crypto.subtle.exportKey('jwk', key);
     localStorage.setItem(ENCRYPTION_KEY, JSON.stringify(exported));
     return key;
   }
   
   export async function encryptApiKey(key: string): Promise<string> {
     const cryptoKey = await getKey();
     const iv = crypto.getRandomValues(new Uint8Array(12));
     const encrypted = await crypto.subtle.encrypt(
       { name: 'AES-GCM', iv }, cryptoKey, new TextEncoder().encode(key));
     return btoa(String.fromCharCode(...iv, ...new Uint8Array(encrypted)));
   }
   
   export async function decryptApiKey(encrypted: string): Promise<string> {
     const cryptoKey = await getKey();
     const data = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
     const iv = data.slice(0, 12);
     const decrypted = await crypto.subtle.decrypt(
       { name: 'AES-GCM', iv }, cryptoKey, data.slice(12));
     return new TextDecoder().decode(decrypted);
   }
   ```

2. Update `config.ts` to use encryption:
   ```typescript
   export async function saveConfig(config: LLMConfig): Promise<void> {
     const encrypted = {
       ...config,
       apiKey: config.apiKey ? await encryptApiKey(config.apiKey) : undefined,
     };
     localStorage.setItem('dks:llm-config', JSON.stringify(encrypted));
   }
   
   export async function loadConfig(): Promise<LLMConfig> {
     const stored = localStorage.getItem('dks:llm-config');
     if (!stored) return DEFAULT_CONFIG;
     const parsed = JSON.parse(stored);
     return {
       ...parsed,
       apiKey: parsed.apiKey ? await decryptApiKey(parsed.apiKey) : undefined,
     };
   }
   ```

3. Add migration for existing plaintext keys.

**Effort**: 3-4h  
**Validation**:
- API keys encrypted in localStorage
- Decryption works correctly
- Migration handles existing keys
- No performance impact

---

### 37.2 Fix SSRF in URL Resolution (MEDIUM)
**Files**: `src/lib/resolver.ts`  
**Action**:

1. Add URL validation:
   ```typescript
   const BLOCKED_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
   const PRIVATE_IP_REGEX = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/;
   
   function validateUrl(url: string): boolean {
     try {
       const parsed = new URL(url);
       if (!['http:', 'https:'].includes(parsed.protocol)) return false;
       if (BLOCKED_HOSTS.includes(parsed.hostname)) return false;
       if (PRIVATE_IP_REGEX.test(parsed.hostname)) return false;
       return true;
     } catch {
       return false;
     }
   }
   ```

2. Update `resolveUrl` to validate before fetching:
   ```typescript
   export const resolveUrl = async (url: string): Promise<ResolvedContent> => {
     if (!validateUrl(url)) {
       throw new AppError('Invalid URL', 'INVALID_URL');
     }
     // ... rest of function
   };
   ```

**Effort**: 1-2h  
**Validation**:
- Private IPs blocked
- Non-HTTP schemes blocked
- Error messages are clear

---

### 37.3 Fix Browser Migration Fallback (HIGH)
**Files**: `src/db/migrate.ts`  
**Action**:

1. Use `import.meta.glob` to bundle all migrations:
   ```typescript
   const migrationModules = import.meta.glob('./migrations/*.sql', {
     query: '?raw',
     import: 'default',
   });
   
   async function loadMigrations(): Promise<Migration[]> {
     const migrations: Migration[] = [];
     for (const [path, loader] of Object.entries(migrationModules)) {
       const content = await loader() as string;
       const name = path.split('/').pop()?.replace('.sql', '') || '';
       migrations.push({ name, content, checksum: parseChecksum(content) });
     }
     return migrations.sort((a, b) => a.name.localeCompare(b.name));
   }
   ```

2. Remove fallback fetch logic.

**Effort**: 1h  
**Validation**:
- All migrations bundled
- No runtime fetch needed
- Schema stays in sync

---

### 37.4 Add Snapshot Validation (HIGH)
**Files**: `src/features/graph/GraphControls.tsx`  
**Action**:

1. Add Zod schemas for snapshot data:
   ```typescript
   const GraphNodeSchema = z.object({
     id: z.string(),
     label: z.string(),
     x: z.number().optional(),
     y: z.number().optional(),
     size: z.number().optional(),
     color: z.string().optional(),
   });
   
   const GraphEdgeSchema = z.object({
     id: z.string(),
     source: z.string(),
     target: z.string(),
     label: z.string().optional(),
   });
   
   const SnapshotDataSchema = z.object({
     nodes: z.array(GraphNodeSchema),
     edges: z.array(GraphEdgeSchema),
   });
   ```

2. Update snapshot loading:
   ```typescript
   const loadedNodes = JSON.parse(snap.nodes_json);
   const loadedEdges = JSON.parse(snap.edges_json);
   
   const nodesResult = SnapshotDataSchema.safeParse({ nodes: loadedNodes, edges: loadedEdges });
   if (!nodesResult.success) {
     logger.error('Invalid snapshot data', nodesResult.error);
     // Show error to user, skip load
     return;
   }
   ```

**Effort**: 1h  
**Validation**:
- Invalid snapshots show error
- Valid snapshots load correctly
- No crashes from corrupt data

---

### 37.5 Add Logging to Silent Catch Blocks (MEDIUM)
**Files**: Multiple  
**Action**:

1. Add `logger.debug()` to all silent catch blocks:
   ```typescript
   // Before
   } catch (e) {
     // silently ignore
   }
   
   // After
   } catch (e) {
     logger.debug('Expected error in <context>', { error: String(e) });
   }
   ```

2. Files to update:
   - `src/lib/resolver.ts:90, 115`
   - `src/lib/perf/core.ts:54, 77, 88`
   - `src/lib/llm/kilo.ts:103`
   - `src/lib/llm/openrouter.ts:103`
   - `src/components/ThemeSwitcher.tsx:48, 57`
   - `src/db/repository.ts:942`
   - `src/db/migrate.ts:201`
   - `src/features/search/SearchPanel.tsx:282`

**Effort**: 1-2h  
**Validation**:
- All catch blocks have logging
- Debug logs don't flood console
- Errors are traceable

---

### 37.6 Fix maskApiKey Redundant Logic (LOW)
**Files**: `src/lib/llm/config.ts:71-74`  
**Action**:

1. Simplify function:
   ```typescript
   export function maskApiKey(key: string): string {
     if (!key) return '';
     return `...${key.slice(-4)}`;
   }
   ```

**Effort**: 5min  
**Validation**:
- Function works correctly
- No redundant logic

---

## Completion Criteria

- [ ] API keys encrypted at rest
- [ ] SSRF protection in URL resolution
- [ ] Browser migrations bundled via import.meta.glob
- [ ] Snapshot data validated with Zod
- [ ] Silent catch blocks have logging
- [ ] maskApiKey simplified
- [ ] All quality gates pass

## Dependencies

- 37.1 (encryption) should be done first — highest security impact
- 37.2-37.6 can be done in parallel
