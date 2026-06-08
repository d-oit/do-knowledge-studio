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
import { CheckCircle, AtSign, Link2, ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import { Entity } from '../../lib/validation';

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
    setIsLoadingEntity(true); // eslint-disable-line react-hooks/set-state-in-effect -- loading flag set before async fetch, not a cascade risk
    repository.getEntityById(editingEntityId).then((entity: (Entity & { rowid: number }) | null) => {
      if (!entity) return;
      setTitle(entity.name || '');
      setType(entity.type);
      setSourceUrl(entity.sourceUrl ?? '');
      setShowAdvanced((entity.metadata?.advanced as boolean | undefined) ?? false);
      setStatus(null);
    }).catch(err => logger.error('Failed to load entity for editing', { error: err }))
    .finally(() => setIsLoadingEntity(false));

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
        setTitle('');
        setSourceUrl('');
        editor.commands.setContent('<p></p>');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('Failed to save entity', { error: err });
      setStatus({ type: 'error', message: `Save failed: ${msg}` });
    }
  }, [title, type, sourceUrl, editingEntityId, onEditComplete, editor, repository]);

  const insertMention = useCallback((target: Entity) => {
    if (!editor || !target.id) return;
    editor.chain().focus().setMention({ entityId: target.id, entityName: target.name }).run();
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
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className={editor?.isActive('bold') ? 'active' : ''}
          aria-label="Toggle Bold"
          title="Bold"
        >
          B
        </button>
        <button
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
          <div className="toolbar-spacer" />
        <button type="button" onClick={() => void handleSave()} className="primary">{editingEntityId ? 'Update Entity' : 'Save to DB'}</button>
        {editingEntityId && (
          <button type="button" onClick={handleCancelEdit} aria-label="Cancel editing">
            Cancel
          </button>
        )}
      </div>
      <EditorContent editor={editor} className="tiptap-content" />

      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
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
