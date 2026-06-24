import React from 'react';
import { CheckCircle, Link2, Undo2, Redo2, Sparkles, Loader2 } from 'lucide-react';
import type { Editor } from '@tiptap/react';

interface EditorToolbarProps {
  editor: Editor | null;
  editingEntityId?: string | null;
  isExtracting: boolean;
  onExtractEntities: () => void;
  onToggleLinkInput: () => void;
  onSave: () => void;
  onCancelEdit: () => void;
}

const EditorToolbar: React.FC<EditorToolbarProps> = ({
  editor,
  editingEntityId,
  isExtracting,
  onExtractEntities,
  onToggleLinkInput,
  onSave,
  onCancelEdit,
}) => {
  return (
    <div className="toolbar">
      <button
        onClick={() => editor?.chain().focus().toggleBold().run()}
        className={editor?.isActive('bold') ? 'active' : ''}
        aria-pressed={editor?.isActive('bold') ?? false}
        aria-label="Toggle Bold"
        title="Bold (Ctrl+B)"
      >
        B
      </button>
      <button
        onClick={() => editor?.chain().focus().toggleItalic().run()}
        className={editor?.isActive('italic') ? 'active' : ''}
        aria-pressed={editor?.isActive('italic') ?? false}
        aria-label="Toggle Italic"
        title="Italic (Ctrl+I)"
      >
        <em>I</em>
      </button>
      <button
        onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
        className={editor?.isActive('heading', { level: 1 }) ? 'active' : ''}
        aria-pressed={editor?.isActive('heading', { level: 1 }) ?? false}
        aria-label="Toggle Heading 1"
        title="Heading 1"
      >
        H1
      </button>
      <button
        onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        className={editor?.isActive('heading', { level: 2 }) ? 'active' : ''}
        aria-pressed={editor?.isActive('heading', { level: 2 }) ?? false}
        aria-label="Toggle Heading 2"
        title="Heading 2"
      >
        H2
      </button>
      <button
        onClick={() => editor?.chain().focus().toggleBulletList().run()}
        className={editor?.isActive('bulletList') ? 'active' : ''}
        aria-pressed={editor?.isActive('bulletList') ?? false}
        aria-label="Toggle Bullet List"
        title="Bullet List"
      >
        • List
      </button>
      <button
        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        className={editor?.isActive('orderedList') ? 'active' : ''}
        aria-pressed={editor?.isActive('orderedList') ?? false}
        aria-label="Toggle Ordered List"
        title="Ordered List"
      >
        1. List
      </button>
      <button
        onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
        className={editor?.isActive('codeBlock') ? 'active' : ''}
        aria-pressed={editor?.isActive('codeBlock') ?? false}
        aria-label="Toggle Code Block"
        title="Code Block"
      >
        {'</>'}
      </button>
      <button
        onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        className={editor?.isActive('blockquote') ? 'active' : ''}
        aria-pressed={editor?.isActive('blockquote') ?? false}
        aria-label="Toggle Blockquote"
        title="Blockquote"
      >
        &ldquo;
      </button>
      <button
        onClick={onToggleLinkInput}
        className={editor?.isActive('link') ? 'active' : ''}
        aria-pressed={editor?.isActive('link') ?? false}
        aria-label="Insert Link"
        title="Insert Link"
      >
        <Link2 size={16} aria-hidden="true" />
      </button>
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
      <button
        onClick={() => editor?.chain().focus().toggleClaim().run()}
        className={editor?.isActive('claim') ? 'active' : ''}
        title="Mark as Claim"
        aria-label="Mark as Claim"
      >
        <CheckCircle size={16} aria-hidden="true" /> Claim
      </button>
      <button
        onClick={onExtractEntities}
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
      <button type="button" onClick={onSave} className="primary" disabled={!editor}>{editingEntityId ? 'Update Entity' : 'Save to DB'}</button>
      {editingEntityId && (
        <button type="button" onClick={onCancelEdit} aria-label="Cancel editing">
          Cancel
        </button>
      )}
    </div>
  );
};

export default EditorToolbar;
