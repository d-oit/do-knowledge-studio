import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { ClaimExtension } from './ClaimExtension';
import { MentionExtension } from './MentionExtension';
import { logger } from '../../lib/logger';
import { repository } from '../../db/repository';
import { jobCoordinator } from '../../lib/jobs';
import { useState, useEffect } from 'react';
import { CheckCircle, AtSign } from 'lucide-react';
import { Entity } from '../../lib/validation';

const Editor: React.FC = () => {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('note');
  const [allEntities, setAllEntities] = useState<Entity[]>([]);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [stats, setStats] = useState({ claims: 0, mentions: 0 });

  useEffect(() => {
    if (status) {
      const timer = setTimeout(() => setStatus(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  useEffect(() => {
    repository.getAllEntities().then(setAllEntities).catch(err => logger.error('Failed to load entities for mentions', err));
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
    onUpdate: ({ editor }) => {
      let claimsCount = 0;
      let mentionsCount = 0;
      editor.state.doc.descendants((node) => {
        if (node.marks.some(m => m.type.name === 'claim') && node.isText) {
          claimsCount++;
        }
        if (node.marks.some(m => m.type.name === 'mention')) {
          mentionsCount++;
        }
        return true;
      });
      setStats({ claims: claimsCount, mentions: mentionsCount });
    }
  });

  const handleSave = async () => {
    if (!title.trim() || !editor) return;

    setSaveStatus('saving');
    try {
      const content = editor.getHTML();
      const entity = await repository.createEntity({
        name: title,
        type: type,
        description: content,
        metadata: {}
      });

      const { doc } = editor.state;
      const claims: string[] = [];
      const mentions: { id: string, name: string }[] = [];

      doc.descendants((node) => {
        const claimMark = node.marks.find(mark => mark.type.name === 'claim');
        if (claimMark && node.isText && node.text) {
          claims.push(node.text);
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

      // Persist Note
      await repository.createNote({
        entity_id: entity.id,
        content: content,
        format: 'markdown'
      });

      // Persist Claims
      for (const statement of claims) {
        await repository.createClaim({
          entity_id: entity.id!,
          statement: statement,
          confidence: 1.0,
          evidence: 'Extracted from editor',
          source: 'Manual entry'
        });
      }

      // Persist Links (Mentions)
      for (const mention of mentions) {
        await repository.createLink({
          source_id: entity.id!,
          target_id: mention.id,
          relation: 'mentions',
          metadata: { name: mention.name }
        });
      }

      logger.info('Entity, note, claims and links saved', { id: entity.id, claims: claims.length, links: mentions.length });

      // Enqueue background work
      jobCoordinator.enqueue('reindex-document', entity.id, { entityId: entity.id });

      setStatus({ type: 'success', message: `Saved successfully! (${claims.length} claims, ${mentions.length} links)` });
      setSaveStatus('saved');
      setTitle('');
      editor.commands.setContent('<p></p>');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      logger.error('Failed to save entity', err);
      setSaveStatus('error');
      setStatus({ type: 'error', message: 'Save failed. Content has been preserved for recovery.' });
    }
  };

  const insertMention = (target: Entity) => {
    if (!editor || !target.id) return;
    editor.chain().focus().setMention({ entityId: target.id, entityName: target.name }).run();
    setShowMentionMenu(false);
    setMentionIndex(0);
  };

  const handleMentionKeyDown = (e: React.KeyboardEvent) => {
    if (!showMentionMenu) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMentionIndex(prev => (prev + 1) % allEntities.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMentionIndex(prev => (prev - 1 + allEntities.length) % allEntities.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allEntities[mentionIndex]) {
        insertMention(allEntities[mentionIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowMentionMenu(false);
    }
  };

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
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Entity Name (e.g. TRIZ)"
        />
        <label htmlFor="entity-type" className="sr-only">Entity Type</label>
        <select id="entity-type" value={type} onChange={e => setType(e.target.value)}>
          <option value="note">Note</option>
          <option value="concept">Concept</option>
          <option value="person">Person</option>
          <option value="project">Project</option>
        </select>
      </div>
      <div className="toolbar" role="toolbar" aria-label="Editor formatting">
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className={editor?.isActive('bold') ? 'active' : ''}
          aria-label="Toggle Bold"
          aria-pressed={editor?.isActive('bold')}
          title="Bold"
        >
          <b>B</b> <span className="toolbar-label">Bold</span>
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
          className={editor?.isActive('heading', { level: 1 }) ? 'active' : ''}
          aria-label="Toggle Heading 1"
          aria-pressed={editor?.isActive('heading', { level: 1 })}
          title="Heading 1"
        >
          H1 <span className="toolbar-label">Heading</span>
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleClaim().run()}
          className={editor?.isActive('claim') ? 'active' : ''}
          title="Mark as Claim"
          aria-label="Mark as Claim"
          aria-pressed={editor?.isActive('claim')}
        >
          <CheckCircle size={16} aria-hidden="true" /> <span className="toolbar-label">Claim</span>
        </button>
        <div className="mention-tool" onKeyDown={handleMentionKeyDown}>
          <button
            type="button"
            onClick={() => {
              setShowMentionMenu(!showMentionMenu);
              setMentionIndex(0);
            }}
            className={editor?.isActive('mention') ? 'active' : ''}
            title="Link to Entity"
            aria-label="Link to Entity"
            aria-haspopup="listbox"
            aria-expanded={showMentionMenu}
            aria-pressed={showMentionMenu}
          >
            <AtSign size={16} aria-hidden="true" /> <span className="toolbar-label">Mention</span>
          </button>
          {showMentionMenu && (
            <div className="mention-menu" role="listbox" aria-label="Entities">
              {allEntities.length === 0 ? (
                <div className="menu-item disabled" role="option" aria-disabled="true">No entities found</div>
              ) : (
                allEntities.map((e, idx) => (
                  <div
                    key={e.id}
                    className={`menu-item ${idx === mentionIndex ? 'selected' : ''}`}
                    onClick={() => insertMention(e)}
                    role="option"
                    aria-selected={idx === mentionIndex}
                  >
                    {e.name}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleSave}
          className={`primary ${saveStatus}`}
          disabled={saveStatus === 'saving'}
        >
          {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save note'}
        </button>
      </div>
      <EditorContent editor={editor} className="tiptap-content" />
      <div className="structure-preview">
        <h4>Structure Preview</h4>
        <div className="preview-grid">
          <div className="preview-item">
            <span className="label">Title:</span>
            <span className="value">{title || '(Untitled)'}</span>
          </div>
          <div className="preview-item">
            <span className="label">Type:</span>
            <span className="value">{type}</span>
          </div>
          <div className="preview-item">
            <span className="label">Claims:</span>
            <span className="value">{stats.claims}</span>
          </div>
          <div className="preview-item">
            <span className="label">Mentions:</span>
            <span className="value">{stats.mentions}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Editor;
