import React, { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { logger } from '../../lib/logger';
import { repository } from '../../db/repository';

const Editor: React.FC = () => {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('note');

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Enter structured knowledge...',
      }),
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

      await repository.createNote({
        entity_id: entity.id,
        content: content,
        format: 'markdown'
      });

      logger.info('Entity and note saved', { id: entity.id });
      alert('Saved successfully!');
      setTitle('');
      editor.commands.setContent('<p></p>');
    } catch (err) {
      logger.error('Failed to save entity', err);
      alert('Save failed. See console for details.');
    }
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
        <button onClick={() => editor?.chain().focus().toggleBold().run()}>B</button>
        <button onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}>H1</button>
        <button onClick={handleSave} className="save-btn">Save to DB</button>
      </div>
      <EditorContent editor={editor} className="tiptap-content" />
    </div>
  );
};

export default Editor;
