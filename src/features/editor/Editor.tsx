import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { ClaimExtension } from './ClaimExtension';
import { MentionExtension } from './MentionExtension';
import { logger } from '../../lib/logger';
import { repository } from '../../db/repository';
import { useState, useEffect } from 'react';
import { CheckCircle, AtSign } from 'lucide-react';
import { Entity } from '../../lib/validation';

const Editor: React.FC = () => {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('note');
  const [allEntities, setAllEntities] = useState<Entity[]>([]);
  const [showMentionMenu, setShowMentionMenu] = useState(false);

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

      logger.info('Entity, note, claims and links saved', { id: entity.id, claims: claims.length, links: mentions.length });
      alert(`Saved successfully! (${claims.length} claims, ${mentions.length} links)`);
      setTitle('');
      editor.commands.setContent('<p></p>');
    } catch (err) {
      logger.error('Failed to save entity', err);
      alert('Save failed. See console for details.');
    }
  };

  const insertMention = (target: Entity) => {
    if (!editor || !target.id) return;
    editor.chain().focus().setMention({ entityId: target.id, entityName: target.name }).run();
    setShowMentionMenu(false);
  };

  return (
    <div className="editor-container">
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
        <button
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className={editor?.isActive('bold') ? 'active' : ''}
        >
          B
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
          className={editor?.isActive('heading', { level: 1 }) ? 'active' : ''}
        >
          H1
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleClaim().run()}
          className={editor?.isActive('claim') ? 'active' : ''}
          title="Mark as Claim"
        >
          <CheckCircle size={16} /> Claim
        </button>
        <div className="mention-tool">
          <button
            onClick={() => setShowMentionMenu(!showMentionMenu)}
            className={editor?.isActive('mention') ? 'active' : ''}
            title="Link to Entity"
          >
            <AtSign size={16} /> Mention
          </button>
          {showMentionMenu && (
            <div className="mention-menu">
              {allEntities.length === 0 ? (
                <div className="menu-item disabled">No entities found</div>
              ) : (
                allEntities.map(e => (
                  <div key={e.id} className="menu-item" onClick={() => insertMention(e)}>
                    {e.name}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        <button onClick={handleSave} className="primary">Save to DB</button>
      </div>
      <EditorContent editor={editor} className="tiptap-content" />
    </div>
  );
};

export default Editor;
