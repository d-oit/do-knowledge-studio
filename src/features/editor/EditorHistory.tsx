import React from 'react';
import type { Editor } from '@tiptap/react';
import { Undo2, Redo2 } from 'lucide-react';

interface EditorHistoryProps {
  editor: Editor | null;
}

const EditorHistory: React.FC<EditorHistoryProps> = ({ editor }) => {
  return (
    <>
      <button
        onClick={() => editor?.chain().focus().undo().run()}
        disabled={!editor?.can?.().undo()}
        aria-label="Undo"
        title="Undo (Ctrl+Z)"
        style={{ opacity: editor?.can?.().undo() ? 1 : 0.4 }}
      >
        <Undo2 size={16} aria-hidden="true" />
      </button>
      <button
        onClick={() => editor?.chain().focus().redo().run()}
        disabled={!editor?.can?.().redo()}
        aria-label="Redo"
        title="Redo (Ctrl+Shift+Z)"
        style={{ opacity: editor?.can?.().redo() ? 1 : 0.4 }}
      >
        <Redo2 size={16} aria-hidden="true" />
      </button>
    </>
  );
};

export default EditorHistory;
