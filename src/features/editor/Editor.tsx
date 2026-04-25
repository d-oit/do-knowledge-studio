import React, { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { ClaimExtension } from './ClaimExtension';
import { MentionExtension } from './MentionExtension';
import { BlockIdExtension } from './BlockIdExtension';
import { logger } from '../../lib/logger';
import { repository } from '../../db/repository';
import { jobCoordinator } from '../../lib/jobs';
import { CheckCircle, AtSign, Link as LinkIcon, Save } from 'lucide-react';
import { Entity } from '../../lib/validation';

const Editor: React.FC = () => {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('note');
  const [allEntities, setAllEntities] = useState<Entity[]>([]);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [showLinkMenu, setShowLinkMenu] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    if (status) {
      const timer = setTimeout(() => setStatus(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  useEffect(() => {
    repository.getAllEntities().then(setAllEntities).catch(err => logger.error('Failed to load entities', err));
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Enter structured knowledge... Use "Claim" for assertions, "Mention" for inline links, and "Block Link" to connect paragraphs to entities.',
      }),
      ClaimExtension,
      MentionExtension,
      BlockIdExtension,
    ],
    content: '<p>Every note is an entity.</p>',
  });

  const handleSave = async () => {
    if (!title.trim() || !editor) return;

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

      logger.info('Entity saved', { id: entity.id });
      jobCoordinator.enqueue('reindex-document', entity.id, { entityId: entity.id });

      setStatus({ type: 'success', message: `Saved successfully!` });
      setTitle('');
      editor.commands.setContent('<p></p>');
    } catch (err) {
      logger.error('Failed to save entity', err);
      setStatus({ type: 'error', message: 'Save failed.' });
    }
  };

  const insertMention = (target: Entity) => {
    if (!editor || !target.id) return;
    editor.chain().focus().setMention({ entityId: target.id, entityName: target.name }).run();
    setShowMentionMenu(false);
  };

  const linkBlockToEntity = async (target: Entity) => {
    if (!editor || !target.id) return;

    const { selection } = editor.state;
    const node = selection.$from.parent;
    const blockId = node.attrs.id;

    if (!blockId) {
      setStatus({ type: 'error', message: 'Could not find block ID. Try clicking in the paragraph again.' });
      return;
    }

    try {
      // For now, we link the current document (if it were saved) or just create a link
      // Since the current entity might not be saved yet, block linking is best used on saved entities.
      // In this demo, we'll log it. A full implementation would track "pending links".
      logger.info('Linking block to entity', { blockId, targetId: target.id });
      setStatus({ type: 'success', message: `Linked block to ${target.name}` });
      setShowLinkMenu(false);
    } catch (err) {
      logger.error('Failed to link block', err);
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
        <input
          className="title-input"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Entity Name (e.g. TRIZ)"
        />
        <select value={type} onChange={e => setType(e.target.value)}>
          <option value="note">Note</option>
          <option value="concept">Concept</option>
          <option value="person">Person</option>
          <option value="project">Project</option>
        </select>
      </div>
      <div className="toolbar">
        <button onClick={() => editor?.chain().focus().toggleBold().run()} className={editor?.isActive('bold') ? 'active' : ''}>B</button>
        <button onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} className={editor?.isActive('heading', { level: 1 }) ? 'active' : ''}>H1</button>
        <button onClick={() => editor?.chain().focus().toggleClaim().run()} className={editor?.isActive('claim') ? 'active' : ''}>
          <CheckCircle size={16} /> Claim
        </button>

        <div className="dropdown-tool">
          <button onClick={() => setShowMentionMenu(!showMentionMenu)} className={editor?.isActive('mention') ? 'active' : ''}>
            <AtSign size={16} /> Mention
          </button>
          {showMentionMenu && (
            <div className="dropdown-menu">
              {allEntities.map(e => (
                <div key={e.id} className="menu-item" onClick={() => insertMention(e)}>{e.name}</div>
              ))}
            </div>
          )}
        </div>

        <div className="dropdown-tool">
          <button onClick={() => setShowLinkMenu(!showLinkMenu)}>
            <LinkIcon size={16} /> Block Link
          </button>
          {showLinkMenu && (
            <div className="dropdown-menu">
              {allEntities.map(e => (
                <div key={e.id} className="menu-item" onClick={() => linkBlockToEntity(e)}>{e.name}</div>
              ))}
            </div>
          )}
        </div>

        <button onClick={handleSave} className="primary"><Save size={16} /> Save</button>
      </div>
      <EditorContent editor={editor} className="tiptap-content" />
    </div>
  );
};

export default Editor;
