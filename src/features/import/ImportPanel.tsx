import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, FileText, FileJson, File, Loader2, AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react';
import { repository } from '../../db/repository';
import { importFromJson } from '../../lib/export-core';
import { importMarkdownFiles } from '../../lib/markdown-importer';
import { hydrateFts5Index } from '../../lib/search/fts5-hydrator';
import { jobCoordinator } from '../../lib/jobs';
import { logger } from '../../lib/logger';

const ACCEPTED_EXTENSIONS = ['.json', '.md', '.opml', '.xml'] as const;
const MAX_FILE_BYTES = 50 * 1024 * 1024;

type ImportFormat = 'json' | 'markdown' | 'opml' | 'unknown';

interface PreviewEntity {
  name: string;
  type: string;
  description?: string;
}

interface PreviewSummary {
  format: ImportFormat;
  entities: PreviewEntity[];
  notes: number;
  claims: number;
  warnings: string[];
  raw: string;
  fileName: string;
}

interface ImportProgress {
  step: 'idle' | 'previewing' | 'importing' | 'reindexing' | 'done' | 'error';
  message: string;
  counts?: { entities: number; notes: number; claims: number };
}

const DEFAULT_ENTITY_TYPE = 'concept';

interface OpmlOutline {
  text: string;
  note?: string;
  children: OpmlOutline[];
}

function detectFormat(fileName: string): ImportFormat {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.opml') || lower.endsWith('.xml')) return 'opml';
  if (lower.endsWith('.md')) return 'markdown';
  return 'unknown';
}

function parseAttrs(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([A-Za-z_][\w:-]*)\s*=\s*"([^"]*)"/g;
  let m: RegExpExecArray | null = re.exec(attrString);
  while (m !== null) {
    attrs[m[1]] = m[2];
    m = re.exec(attrString);
  }
  return attrs;
}

function parseOpmlOutlines(raw: string): OpmlOutline[] {
  const tagRe = /<(\/?)outline\b([^>]*)>/g;
  const roots: OpmlOutline[] = [];
  const stack: OpmlOutline[] = [];
  let match: RegExpExecArray | null = tagRe.exec(raw);
  while (match !== null) {
    const isClose = match[1] === '/';
    const isSelfClose = match[2].trimEnd().endsWith('/');
    if (isClose) {
      stack.pop();
      match = tagRe.exec(raw);
      continue;
    }
    const attrs = parseAttrs(isSelfClose ? match[2].trimEnd().slice(0, -1) : match[2]);
    const entry: OpmlOutline = {
      text: attrs.text ?? attrs.title ?? 'Untitled',
      ...(attrs.note ? { note: attrs.note } : {}),
      children: [],
    };
    const parent = stack[stack.length - 1];
    if (parent) parent.children.push(entry);
    else roots.push(entry);
    if (!isSelfClose) stack.push(entry);
    match = tagRe.exec(raw);
  }
  return roots;
}

function flattenOpml(entries: OpmlOutline[]): PreviewEntity[] {
  const out: PreviewEntity[] = [];
  const visit = (e: OpmlOutline): void => {
    if (e.text.trim()) {
      out.push({
        name: e.text.trim(),
        type: DEFAULT_ENTITY_TYPE,
        ...(e.note ? { description: e.note } : {}),
      });
    }
    for (const child of e.children) visit(child);
  };
  for (const root of entries) visit(root);
  return out;
}

function buildPreview(fileName: string, content: string): PreviewSummary {
  const format = detectFormat(fileName);
  const warnings: string[] = [];

  if (format === 'json') {
    try {
      const exp = importFromJson(content);
      const entities: PreviewEntity[] = exp.entities.map((e) => ({
        name: e.name,
        type: e.type || DEFAULT_ENTITY_TYPE,
        ...(e.description ? { description: e.description } : {}),
      }));
      return {
        format,
        entities,
        notes: exp.notes.length,
        claims: exp.claims.length,
        warnings,
        raw: content,
        fileName,
      };
    } catch (err) {
      return {
        format,
        entities: [],
        notes: 0,
        claims: 0,
        warnings: [`Invalid JSON export: ${err instanceof Error ? err.message : String(err)}`],
        raw: content,
        fileName,
      };
    }
  }

  if (format === 'opml') {
    const outlines = parseOpmlOutlines(content);
    return {
      format,
      entities: flattenOpml(outlines),
      notes: 0,
      claims: 0,
      warnings,
      raw: content,
      fileName,
    };
  }

  if (format === 'markdown') {
    const result = importMarkdownFiles([{ name: fileName, content }]);
    for (const err of result.errors) warnings.push(`${err.file}: ${err.error}`);
    return {
      format,
      entities: [],
      notes: result.notes.length,
      claims: 0,
      warnings,
      raw: content,
      fileName,
    };
  }

  warnings.push(`Unsupported file type: ${fileName}`);
  return { format: 'unknown', entities: [], notes: 0, claims: 0, warnings, raw: content, fileName };
}

/**
 * Drag-and-drop import surface for JSON and Markdown files.
 *
 * The panel previews the parsed plan (entities/notes/claims counts and
 * warnings) before persisting anything, then writes through the
 * repository. Files larger than `MAX_FILE_BYTES` are rejected up
 * front. The progress state machine (`idle → previewing → importing →
 * done | error`) drives the status banner.
 */
/**
 * Drag-and-drop import surface for JSON and Markdown files.
 *
 * The panel previews the parsed plan (entities/notes/claims counts and
 * warnings) before persisting anything, then writes through the
 * repository. Files larger than `MAX_FILE_BYTES` are rejected up
 * front. The progress state machine (`idle → previewing → importing →
 * done | error`) drives the status banner.
 */
/**
 * Drag-and-drop import surface for JSON and Markdown files.
 *
 * The panel previews the parsed plan (entities/notes/claims counts and
 * warnings) before persisting anything, then writes through the
 * repository. Files larger than `MAX_FILE_BYTES` are rejected up
 * front. The progress state machine (`idle → previewing → importing →
 * done | error`) drives the status banner.
 */
const ImportPanel: React.FC = () => {
  const [preview, setPreview] = useState<PreviewSummary | null>(null);
  const [progress, setProgress] = useState<ImportProgress>({ step: 'idle', message: '' });
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setProgress({ step: 'previewing', message: `Reading ${file.name}…` });
    try {
      if (file.size > MAX_FILE_BYTES) {
        setProgress({ step: 'error', message: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB > 50 MB limit)` });
        return;
      }
      const content = await file.text();
      const summary = buildPreview(file.name, content);
      setPreview(summary);
      setProgress({ step: 'idle', message: '' });
    } catch (err) {
      setProgress({ step: 'error', message: `Failed to read file: ${err instanceof Error ? err.message : String(err)}` });
    }
  }, []);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { void handleFile(file); }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [handleFile]);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) { void handleFile(file); }
  }, [handleFile]);

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const performImport = useCallback(async () => {
    if (!preview || preview.format === 'unknown') return;
    setProgress({ step: 'importing', message: 'Writing to repository…' });

    const counts = { entities: 0, notes: 0, claims: 0 };
    const nameToId = new Map<string, string>();

    try {
      for (const entity of preview.entities) {
        const existing = await repository.getEntityByName(entity.name);
        if (existing?.id) {
          nameToId.set(entity.name, existing.id);
          continue;
        }
        const created = await repository.createEntity({
          name: entity.name,
          type: entity.type,
          ...(entity.description ? { description: entity.description } : {}),
        });
        if (created.id) nameToId.set(entity.name, created.id);
        counts.entities++;
      }

      if (preview.format === 'json') {
        const exp = importFromJson(preview.raw);
        const entityNameById = new Map<string, string>();
        for (const entity of exp.entities) {
          if (entity.id && entity.name) entityNameById.set(entity.id, entity.name);
        }
        for (const claim of exp.claims) {
          const entityName = entityNameById.get(claim.entity_id);
          if (!entityName) continue;
          const entityId = nameToId.get(entityName);
          if (!entityId) continue;
          await repository.createClaim({
            entity_id: entityId,
            statement: claim.statement,
            ...(claim.evidence ? { evidence: claim.evidence } : {}),
            confidence: claim.confidence,
            ...(claim.source ? { source: claim.source } : {}),
            verification_status: claim.verification_status,
          });
          counts.claims++;
        }
        for (const note of exp.notes) {
          const entityName = note.entity_id ? entityNameById.get(note.entity_id) ?? null : null;
          const entityId = entityName ? nameToId.get(entityName) ?? null : null;
          await repository.createNote({
            ...(entityId ? { entity_id: entityId } : { entity_id: null }),
            content: note.content,
            format: note.format,
          });
          counts.notes++;
        }
      } else if (preview.format === 'markdown') {
        const result = importMarkdownFiles([{ name: preview.fileName, content: preview.raw }]);
        for (const note of result.notes) {
          const entityId = note.title ? nameToId.get(note.title) ?? null : null;
          await repository.createNote({
            ...(entityId ? { entity_id: entityId } : { entity_id: null }),
            content: note.content,
            format: note.format,
          });
          counts.notes++;
        }
      }

      setProgress({ step: 'reindexing', message: 'Rebuilding FTS5 index…', counts });
      await hydrateFts5Index();
      jobCoordinator.enqueue('refresh-search-index');

      setProgress({
        step: 'done',
        message: `Imported ${counts.entities} entities, ${counts.notes} notes, ${counts.claims} claims`,
        counts,
      });
      setPreview(null);
    } catch (err) {
      logger.error('Import failed', err);
      setProgress({ step: 'error', message: `Import failed: ${err instanceof Error ? err.message : String(err)}` });
    }
  }, [preview]);

  useEffect(() => {
    const inputEl = fileInputRef.current;
    return () => {
      if (inputEl) inputEl.value = '';
    };
  }, []);

  const totalItems = preview ? preview.entities.length + preview.notes + preview.claims : 0;
  const isImportable = preview !== null && preview.format !== 'unknown' && totalItems > 0;
  const isWorking = progress.step === 'previewing' || progress.step === 'importing' || progress.step === 'reindexing';

  return (
    <div className="editor-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <Upload size={24} />
        <h2 style={{ margin: 0 }}>Import Knowledge</h2>
      </div>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
        Import entities, notes, and claims from JSON exports, Markdown files, or OPML outlines. All processing happens locally.
      </p>

      {progress.step === 'error' && (
        <div role="alert" style={{ marginBottom: '16px', padding: '12px', background: 'var(--status-danger-bg)', color: 'var(--status-danger-text)', borderRadius: '8px', border: '1px solid var(--status-danger-border)', fontSize: '0.875rem' }}>
          <AlertTriangle size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          {progress.message}
        </div>
      )}

      {progress.step === 'done' && progress.counts && (
        <div role="status" style={{ marginBottom: '16px', padding: '12px', background: 'var(--status-success-bg)', color: 'var(--status-success-text)', borderRadius: '8px', border: '1px solid var(--status-success-border)', fontSize: '0.875rem' }}>
          <CheckCircle2 size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          {progress.message}
        </div>
      )}

      <button
        type="button"
        onDrop={(...args) => { onDrop(...args); }}
        onDragOver={(...args) => { onDragOver(...args); }}
        onDragLeave={(...args) => { onDragLeave(...args); }}
        style={{
          padding: '32px',
          border: `2px dashed ${isDragging ? 'var(--interactive-primary)' : 'var(--border-default)'}`,
          borderRadius: '12px',
          textAlign: 'center',
          background: isDragging ? 'var(--surface-hover)' : 'var(--surface-elevated)',
          marginBottom: '24px',
          cursor: 'pointer',
          minHeight: '160px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onClick={() => fileInputRef.current?.click()}
        aria-label="Drop file here or click to browse"
      >
        <Upload size={32} color="var(--text-secondary)" />
        <p style={{ margin: '12px 0 4px', fontWeight: 600 }}>
          {isDragging ? 'Release to import' : 'Drop a file here, or click to browse'}
        </p>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Accepts .json, .md, .opml, .xml (max 50 MB)
        </p>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS.join(',')}
        onChange={(...args) => { onFileChange(...args); }}
        style={{ display: 'none' }}
        aria-label="Import file"
      />

      {preview && (
        <section aria-label="Import preview" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-default)', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              {preview.format === 'json' && <FileJson size={20} />}
              {preview.format === 'markdown' && <FileText size={20} />}
              {preview.format === 'opml' && <File size={20} />}
              {preview.fileName}
            </h3>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="btn-icon"
              aria-label="Discard preview"
            >
              <Trash2 size={16} />
            </button>
          </div>

          <p style={{ color: 'var(--text-secondary)', margin: '0 0 12px' }}>
            {preview.format === 'json' && 'JSON knowledge-base export detected.'}
            {preview.format === 'markdown' && 'Markdown file detected.'}
            {preview.format === 'opml' && 'OPML outline detected.'}
            {preview.format === 'unknown' && 'Unknown file format.'}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', marginBottom: '12px' }}>
            <div style={{ padding: '12px', background: 'var(--surface-base)', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{preview.entities.length}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>entities</div>
            </div>
            <div style={{ padding: '12px', background: 'var(--surface-base)', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{preview.notes}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>notes</div>
            </div>
            <div style={{ padding: '12px', background: 'var(--surface-base)', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{preview.claims}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>claims</div>
            </div>
          </div>

          {preview.entities.length > 0 && (
            <details style={{ marginBottom: '12px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 500 }}>Entities ({preview.entities.length})</summary>
              <ul style={{ margin: '8px 0 0', paddingLeft: '20px', maxHeight: '200px', overflowY: 'auto', fontSize: '0.875rem' }}>
                {preview.entities.slice(0, 50).map((e) => (
                  <li key={e.name}><strong>{e.name}</strong> <span style={{ color: 'var(--text-secondary)' }}>({e.type})</span></li>
                ))}
                {preview.entities.length > 50 && (
                  <li style={{ color: 'var(--text-secondary)' }}>… and {preview.entities.length - 50} more</li>
                )}
              </ul>
            </details>
          )}

          {preview.warnings.length > 0 && (
            <div style={{ padding: '8px 12px', background: 'var(--status-warning-bg, #fef3c7)', color: 'var(--status-warning-text)', borderRadius: '6px', fontSize: '0.8rem', marginBottom: '12px' }}>
              {preview.warnings.map((w) => <div key={w}>{w}</div>)}
            </div>
          )}

          <button
            type="button"
            onClick={() => { void performImport(); }}
            disabled={!isImportable || isWorking}
            className="primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            aria-label="Import previewed items"
          >
            {isWorking ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
            {isWorking ? progress.message : `Import ${totalItems} item(s)`}
          </button>
        </section>
      )}
    </div>
  );
};

export default ImportPanel;
