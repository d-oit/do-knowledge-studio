import React, { useState, useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { ClaimExtension } from './ClaimExtension';
import { MentionExtension } from './MentionExtension';
import { logger } from '../../lib/logger';
import { useRepository } from '../../db/useRepository';
import { jobCoordinator } from '../../lib/jobs';
import { upsertToSearchIndex } from '../../lib/search';
import { perf } from '../../lib/perf';
import { CheckCircle, AtSign, Link2, ChevronDown, ChevronRight, Pencil, Sparkles, X, Loader2 } from 'lucide-react';
import { Entity } from '../../lib/validation';
import { extractEntities, EntityExtractionResult } from '../../lib/ai/entity-extractor';
import { loadConfig, createProvider } from '../../lib/llm/config';
import EntityReviewDialog from '../ai/EntityReviewDialog';

const ENTITY_TYPES = [
  { value: 'note', label: 'Note' },
  { value: 'concept', label: 'Concept' },
  { value: 'person', label: 'Person' },
  { value: 'project', label: 'Project' },
] as const;

interface EditorProps {
  editingEntityId?: string | null;
  onEditComplete?: () => void;
}

const Editor: React.FC<EditorProps> = ({ editingEntityId, onEditComplete }) => {
  const repository = useRepository();
  const [title, setTitle] = useState('');
  const [type, setType] = useState('note');
  const [sourceUrl, setSourceUrl] = useState('');
  const [allEntities, setAllEntities] = useState<Entity[]>([]);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [isLoadingEntity, setIsLoadingEntity] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionResult, setExtractionResult] = useState<EntityExtractionResult | null>(null);
  const [showExtractionReview, setShowExtractionReview] = useState(false);
  const [extractionSourceId, setExtractionSourceId] = useState<string | undefined>(undefined);
  const [showExtractionNotice, setShowExtractionNotice] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder,
      ClaimExtension,
      MentionExtension
    ],
    content: '<p></p>',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none'
      }
    }
  });

  useEffect(() => {
    if (status) {
      const timer = setTimeout(() => setStatus(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  useEffect(() => {
    perf.mark('editor-mount');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- type resolution through Promise chain
    repository.getAllEntities().then((entities: Entity[]) => setAllEntities(entities)).catch(err => logger.error('Failed to load entities for mentions', { error: err }));
    perf.measure('editor-ready', 'editor-mount');
  }, [repository]);

  useEffect(() => {
    if (!editingEntityId) {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoadingEntity(true);
    /* eslint-disable @typescript-eslint/no-unsafe-assignment -- type resolution through Promise chain */
    repository.getEntityById(editingEntityId).then((entity: (Entity & { rowid: number }) | null) => {
      if (!entity) return;
      setTitle(entity.name || '');
      setType(entity.type);
      setSourceUrl(entity.sourceUrl ?? '');
      setShowAdvanced(entity.metadata?.advanced ?? false);
      setStatus(null);
    }).catch(err => logger.error('Failed to load entity for editing', { error: err }))
    .finally(() => setIsLoadingEntity(false));
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */

  }, [editingEntityId, repository]);

  const handleTypeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setType(e.target.value);
  }, []);

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  }, []);

  const handleSourceUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSourceUrl(e.target.value);
  }, []);

  const handleExtractEntities = useCallback(async (entityId?: string, forceContent?: string) => {
    if (!editor || isExtracting) return;

    const content = forceContent || editor.getHTML();
    if (!content.trim() || content === '<p></p>') return;

    setIsExtracting(true);
    try {
      const config = await loadConfig();
      const provider = createProvider(config);
      const providerConfig = config.providers[config.activeProvider];
      const model = providerConfig.defaultModel || 'google/gemini-2.0-flash-lite-preview-02-05:free';

      const result = await extractEntities(content, provider, model);
      setExtractionResult(result);
      setExtractionSourceId(entityId || editingEntityId || undefined);
      setShowExtractionNotice(true);
    } catch (err) {
      logger.error('Failed to extract entities', err);
      setStatus({ type: 'error', message: 'Failed to extract entities with AI' });
    } finally {
      setIsExtracting(false);
    }
  }, [editor, isExtracting, editingEntityId]);

  const handleSave = useCallback(async () => {
    if (!title.trim() || !editor) return;

    try {
      const content = editor.getHTML();

      if (editingEntityId) {
        // Update existing entity
        const entity = await repository.updateEntity(editingEntityId, {
          name: title,
          type: type,
          description: content,
          sourceUrl: sourceUrl.trim() || undefined,
        });

        // Update search index
        await upsertToSearchIndex(editingEntityId);

        logger.info('Entity updated', { id: entity.id });
        setStatus({ type: 'success', message: 'Entity updated successfully!' });
        onEditComplete?.();
      } else {
        // Create new entity
        const entity = await repository.createEntity({
          name: title,
          type: type,
          description: content,
          sourceUrl: sourceUrl.trim() || undefined,
          metadata: {}
        });

        // Enqueue external URL fetch for auto-hydration if source URL provided
        if (sourceUrl.trim()) {
          jobCoordinator.enqueue('external-fetch', entity.id, {
            url: sourceUrl.trim(),
            entityId: entity.id!,
          });
          logger.info('Enqueued external fetch for entity auto-hydration', { entityId: entity.id, url: sourceUrl });
        }

        const { doc } = editor.state;
        const claims: { statement: string; source: string; status: string }[] = [];
        const mentions: { id: string, name: string }[] = [];

        doc.descendants((node) => {
          const claimMark = node.marks.find(mark => mark.type.name === 'claim');
          if (claimMark && node.isText && node.text) {
            claims.push({
              statement: node.text,
              source: (claimMark.attrs.source as string) || 'Manual entry',
              status: (claimMark.attrs.verification_status as string) || 'unverified'
            });
          }

          const mentionMark = node.marks.find(mark => mark.type.name === 'mention');
          if (mentionMark) {
            mentions.push({
              id: mentionMark.attrs.entityId as string,
              name: mentionMark.attrs.entityName as string
            });
          }
          return true;
        });

        const statements: { sql: string; bind?: (string | number | boolean | null)[] }[] = [];

        statements.push({
          sql: `INSERT INTO notes (entity_id, content, format) VALUES (?, ?, ?)`,
          bind: [entity.id, content, 'markdown']
        });

        for (const claim of claims) {
          statements.push({
            sql: `INSERT INTO claims (entity_id, statement, confidence, evidence, source, verification_status)
                  VALUES (?, ?, ?, ?, ?, ?)`,
            bind: [entity.id!, claim.statement, 1.0, 'Extracted from editor', claim.source, claim.status]
          });
        }

        for (const mention of mentions) {
          statements.push({
            sql: `INSERT INTO links (source_id, target_id, relation, metadata)
                  VALUES (?, ?, ?, ?)`,
            bind: [entity.id!, mention.id, 'mentions', JSON.stringify({ name: mention.name })]
          });
        }

        if (statements.length > 0) {
          await repository.transaction(statements);
        }

        logger.info('Entity, note, claims and links saved via transaction', { id: entity.id, claims: claims.length, links: mentions.length });

        jobCoordinator.enqueue('reindex-document', entity.id, { entityId: entity.id });

        setStatus({ type: 'success', message: `Saved successfully! (${claims.length} claims, ${mentions.length} links)${sourceUrl.trim() ? ' — fetching source...' : ''}` });

        // Auto-trigger extraction after 3s debounce
        // Capture content before clearing editor
        const savedContent = content;
        setTimeout(() => {
          void handleExtractEntities(entity.id, savedContent);
        }, 3000);

        setTitle('');
        setSourceUrl('');
        editor.commands.setContent('<p></p>');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('Failed to save entity', { error: err });
      setStatus({ type: 'error', message: `Save failed: ${msg}` });
    }
  }, [title, type, sourceUrl, editingEntityId, onEditComplete, editor, repository, handleExtractEntities]);

  const insertMention = useCallback((target: Entity) => {
    if (!editor || !target.id) return;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    (editor.chain().focus() as unknown as { setMention: (attrs: { entityId: string; entityName: string }) => { run: () => void } }).setMention({ entityId: target.id, entityName: target.name }).run();
    setShowMentionMenu(false);
  }, [editor]);

  const handleCancelEdit = useCallback(() => {
    setTitle('');
    setSourceUrl('');
    setType('note');
    if (editor) editor.commands.setContent('<p></p>');
    onEditComplete?.();
  }, [editor, onEditComplete]);

  return (
    <div className="editor-container">
      {status && (
        <div className={`status-message ${status.type}`} role="alert">
          {status.message}
        </div>
      )}
      {editingEntityId && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--interactive-primary)', fontSize: '13px', fontWeight: 600 }}>
          <Pencil size={14} aria-hidden="true" />
          {isLoadingEntity ? 'Loading entity...' : 'Editing Entity'}
        </div>
      )}
      <div className="entity-meta">
        <label htmlFor="entity-title" className="sr-only">Entity Name</label>
        <input
          id="entity-title"
          className="title-input"
          type="text"
          value={title}
          onChange={handleTitleChange}
          placeholder="Entity Name (e.g. TRIZ)"
        />
        <label htmlFor="entity-type" className="sr-only">Entity Type</label>
        <select id="entity-type" value={type} onChange={handleTypeChange}>
          {ENTITY_TYPES.map(et => (
            <option key={et.value} value={et.value}>{et.label}</option>
          ))}
        </select>
      </div>
      <div className="toolbar">
        <button
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className={editor?.isActive('bold') ? 'active' : ''}
          aria-label="Toggle Bold"
          title="Bold"
        >
          B
        </button>
        <button
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
          onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
          className={editor?.isActive('heading', { level: 1 }) ? 'active' : ''}
          aria-label="Toggle Heading 1"
          title="Heading 1"
        >
          H1
        </button>
          <button
            onClick={() => editor?.chain().focus().toggleClaim().run()}
            className={editor?.isActive('claim') ? 'active' : ''}
            title="Mark as Claim"
            aria-label="Mark as Claim"
          >
            <CheckCircle size={16} aria-hidden="true" /> Claim
          </button>
          <button
            onClick={() => void handleExtractEntities()}
            disabled={isExtracting}
            title="Extract entities with AI"
            aria-label="Extract entities with AI"
            style={{ color: 'var(--interactive-primary)' }}
          >
            {isExtracting ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles size={16} aria-hidden="true" />
            )}
            AI Extract
          </button>
          <div className="toolbar-spacer" />
        <button type="button" onClick={() => void handleSave()} className="primary">{editingEntityId ? 'Update Entity' : 'Save to DB'}</button>
        {editingEntityId && (
          <button type="button" onClick={handleCancelEdit} aria-label="Cancel editing">
            Cancel
          </button>
        )}
      </div>
      <EditorContent editor={editor} className="tiptap-content" />

      {showExtractionNotice && extractionResult && (
        <div style={{
          marginTop: '16px',
          padding: '12px 16px',
          background: 'var(--interactive-primary-subtle)',
          borderRadius: '8px',
          border: '1px solid var(--interactive-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <Sparkles size={16} style={{ color: 'var(--interactive-primary)' }} />
            <span>
              AI found <strong>{extractionResult.entities.length} entities</strong> and <strong>{extractionResult.relationships.length} relationships</strong> in this note.
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => { setShowExtractionReview(true); }}
              className="primary"
              style={{ padding: '4px 12px', fontSize: '12px', minHeight: '32px' }}
            >
              Review
            </button>
            <button
              type="button"
              onClick={() => { setShowExtractionNotice(false); }}
              style={{ padding: '4px 8px', fontSize: '12px', minHeight: '32px', background: 'transparent', border: 'none' }}
              aria-label="Dismiss"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {showExtractionReview && extractionResult && (
        <EntityReviewDialog
          result={extractionResult}
          sourceNoteId={extractionSourceId}
          onClose={() => { setShowExtractionReview(false); }}
          onComplete={() => {
            setShowExtractionNotice(false);
            setExtractionResult(null);
            onEditComplete?.();
          }}
        />
      )}

      <button
        type="button"
        onClick={() => { setShowAdvanced(!showAdvanced); }}
        className="advanced-toggle"
        aria-expanded={showAdvanced}
        aria-label="Toggle advanced options"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 0',
          border: 'none',
          background: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          fontSize: '12px',
          minHeight: '44px',
          fontFamily: 'var(--font-mono, monospace)',
        }}
      >
        {showAdvanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        Advanced
      </button>

      {showAdvanced && (
         <div className="advanced-section" style={{ padding: '0 0 8px 0' }}>
            <div className="entity-source" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Link2 size={14} aria-hidden="true" />
              <label htmlFor="entity-source-url" className="sr-only">Source URL (optional)</label>
              <input
                id="entity-source-url"
                className="source-input"
                value={sourceUrl}
                onChange={handleSourceUrlChange}
                placeholder="Source URL — auto-hydrate description"
                type="url"
                style={{ flex: 1 }}
              />
            </div>

           <button
             type="button"
             onClick={() => setShowMentionMenu(!showMentionMenu)}
             aria-label="Link to Entity"
             title="Link to Entity"
             style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', minHeight: '44px' }}
           >
             <AtSign size={14} aria-hidden="true" /> Mention
           </button>
         </div>
       )}
       {showAdvanced && showMentionMenu && (
         <div className="mention-section" style={{ marginTop: '16px' }}>
           <h4 className="block text-sm font-medium mb-2">Link to Entity</h4>
           <div className="space-y-2">
             {allEntities.map(entity => (
               <button
                 key={entity.id}
                 onClick={() => {
                   insertMention(entity);
                   setShowMentionMenu(false);
                 }}
                 className="mention-item w-full text-left px-3 py-2 rounded border border-muted hover:bg-muted"
               >
                 {entity.name} ({entity.type})
               </button>
             ))}
           </div>
         </div>
       )}

    </div>
  );
};

export default Editor;
