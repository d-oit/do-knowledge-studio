import React, { useState, useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { ClaimExtension } from './ClaimExtension';
import { MentionExtension } from './MentionExtension';
import { logger } from '../../lib/logger';
import { repository } from '../../db/repository';
import { jobCoordinator } from '../../lib/jobs';
import { perf } from '../../lib/perf';
import { CheckCircle, AtSign, Link2, ChevronDown, ChevronRight } from 'lucide-react';
import { Entity } from '../../lib/validation';

const ENTITY_TYPES = [
  { value: 'note', label: 'Note' },
  { value: 'concept', label: 'Concept' },
  { value: 'person', label: 'Person' },
  { value: 'project', label: 'Project' },
] as const;

// Module-level style constants to avoid inline object recreation on every render
const ADVANCED_TOGGLE_STYLE: React.CSSProperties = {
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
};

const ADVANCED_SECTION_STYLE: React.CSSProperties = { padding: '0 0 8px 0' };

const ENTITY_SOURCE_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  marginBottom: '8px',
};

const SOURCE_INPUT_STYLE: React.CSSProperties = { flex: 1 };

const MENTION_BUTTON_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 12px',
  minHeight: '44px',
};

const MENTION_MENU_STYLE: React.CSSProperties = { marginTop: '4px' };

const Editor: React.FC = () => {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('note');
  const [sourceUrl, setSourceUrl] = useState('');
  const [allEntities, setAllEntities] = useState<Entity[]>([]);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    if (status) {
      const timer = setTimeout(() => setStatus(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  useEffect(() => {
    perf.mark('editor-mount');
    repository.getAllEntities().then(setAllEntities).catch(err => logger.error('Failed to load entities for mentions', err));
    perf.measure('editor-ready', 'editor-mount');
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Enter structured knowledge... Use "Claim" for assertions and "Mention" for links.',
      }),
      ClaimExtension,
      MentionExtension,
    ],
    content: '<p>Every note is an entity.</p>',
  });

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

      // We use a transaction for all related records to ensure atomicity and performance
      const entity = await repository.createEntity({
        name: title,
        type: type,
        description: content,
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

      doc.descendants((node: { marks: Array<{ type: { name: string }; attrs: Record<string, string> }>; isText: boolean; text?: string }) => {
        const claimMark = node.marks.find(mark => mark.type.name === 'claim');
        if (claimMark && node.isText && node.text) {
          claims.push({
            statement: node.text,
            source: claimMark.attrs.source || 'Manual entry',
            status: claimMark.attrs.verification_status || 'unverified'
          });
        }

        const mentionMark = node.marks.find(mark => mark.type.name === 'mention');
        if (mentionMark) {
          mentions.push({
            id: mentionMark.attrs.entityId,
            name: mentionMark.attrs.entityName
          });
        }
        return true;
      });

      const statements: { sql: string; bind?: (string | number | boolean | null)[] }[] = [];

      // Note
      statements.push({
        sql: `INSERT INTO notes (entity_id, content, format) VALUES (?, ?, ?)`,
        bind: [entity.id, content, 'markdown']
      });

      // Claims
      for (const claim of claims) {
        statements.push({
          sql: `INSERT INTO claims (entity_id, statement, confidence, evidence, source, verification_status)
                VALUES (?, ?, ?, ?, ?, ?)`,
          bind: [entity.id!, claim.statement, 1.0, 'Extracted from editor', claim.source, claim.status]
        });
      }

      // Links (Mentions)
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

      // Enqueue background work
      jobCoordinator.enqueue('reindex-document', entity.id, { entityId: entity.id });

      setStatus({ type: 'success', message: `Saved successfully! (${claims.length} claims, ${mentions.length} links)${sourceUrl.trim() ? ' — fetching source...' : ''}` });
      setTitle('');
      setSourceUrl('');
      editor.commands.setContent('<p></p>');
    } catch (err) {
      logger.error('Failed to save entity', err);
      setStatus({ type: 'error', message: 'Save failed. See console for details.' });
    }
  }, [title, editor, type, sourceUrl]);

  const insertMention = useCallback((target: Entity) => {
    if (!editor || !target.id) return;
    editor.chain().focus().setMention({ entityId: target.id, entityName: target.name }).run();
    setShowMentionMenu(false);
  }, [editor]);

  return (
    <div className="editor-container">
      {status && (
        <div className={`status-message ${status.type}`} role="alert">
          {status.message}
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
        <button onClick={() => { void handleSave(); }} className="primary">Save to DB</button>
      </div>
      <EditorContent editor={editor} className="tiptap-content" />

      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="advanced-toggle"
        aria-expanded={showAdvanced}
        aria-label="Toggle advanced options"
        style={ADVANCED_TOGGLE_STYLE}
      >
        {showAdvanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        Advanced
      </button>

      {showAdvanced && (
        <div className="advanced-section" style={ADVANCED_SECTION_STYLE}>
          <div className="entity-source" style={ENTITY_SOURCE_STYLE}>
            <Link2 size={14} aria-hidden="true" />
            <label htmlFor="entity-source-url" className="sr-only">Source URL (optional)</label>
            <input
              id="entity-source-url"
              className="source-input"
              value={sourceUrl}
              onChange={handleSourceUrlChange}
              placeholder="Source URL — auto-hydrate description"
              type="url"
              style={SOURCE_INPUT_STYLE}
            />
          </div>
          <div className="mention-tool">
            <button
              onClick={() => setShowMentionMenu(!showMentionMenu)}
              className={editor?.isActive('mention') ? 'active' : ''}
              title="Link to Entity"
              aria-label="Link to Entity"
              style={MENTION_BUTTON_STYLE}
            >
              <AtSign size={14} aria-hidden="true" /> Mention
            </button>
            {showMentionMenu && (
              <div className="mention-menu" style={MENTION_MENU_STYLE}>
                {allEntities.length === 0 ? (
                  <div className="menu-item disabled">No entities found</div>
                ) : (
                  allEntities.map(e => (
                    <div key={e.id} className="menu-item" onClick={() => insertMention(e)} role="button" tabIndex={0} onKeyDown={(ev) => { if (ev.key === 'Enter') insertMention(e); }}>
                      {e.name}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Editor;
