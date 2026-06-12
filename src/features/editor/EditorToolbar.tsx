import React from 'react';
import type { Editor } from '@tiptap/react';
import { CheckCircle, Link2, Sparkles, Loader2 } from 'lucide-react';
import EditorHistory from './EditorHistory';

interface EditorToolbarProps {
  editor: Editor | null;
  showLinkInput: boolean;
  linkUrl: string;
  setLinkUrl: (url: string) => void;
  setLink: () => void;
  setShowLinkInput: (show: boolean) => void;
  isExtracting: boolean;
  onExtractEntities: () => void;
  onSave: () => void;
  onCancelEdit: () => void;
  editingEntityId?: string | null;
}

const EditorToolbar: React.FC<EditorToolbarProps> = ({
  editor,
  showLinkInput,
  linkUrl,
  setLinkUrl,
  setLink,
  setShowLinkInput,
  isExtracting,
  onExtractEntities,
  onSave,
  onCancelEdit,
  editingEntityId,
}) => {
  return (
    <>
      <div className="toolbar">
        <button
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className={editor?.isActive('bold') ? 'active' : ''}
          aria-label="Toggle Bold"
          title="Bold (Ctrl+B)"
        >
          B
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          className={editor?.isActive('italic') ? 'active' : ''}
          aria-label="Toggle Italic"
          title="Italic (Ctrl+I)"
        >
          <em>I</em>
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
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          className={editor?.isActive('heading', { level: 2 }) ? 'active' : ''}
          aria-label="Toggle Heading 2"
          title="Heading 2"
        >
          H2
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          className={editor?.isActive('bulletList') ? 'active' : ''}
          aria-label="Toggle Bullet List"
          title="Bullet List"
        >
          • List
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          className={editor?.isActive('orderedList') ? 'active' : ''}
          aria-label="Toggle Ordered List"
          title="Ordered List"
        >
          1. List
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
          className={editor?.isActive('codeBlock') ? 'active' : ''}
          aria-label="Toggle Code Block"
          title="Code Block"
        >
          {'</>'}
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          className={editor?.isActive('blockquote') ? 'active' : ''}
          aria-label="Toggle Blockquote"
          title="Blockquote"
        >
          &ldquo;
        </button>
        <button
          onClick={() => { setShowLinkInput(!showLinkInput); }}
          className={editor?.isActive('link') ? 'active' : ''}
          aria-label="Insert Link"
          title="Insert Link"
        >
          <Link2 size={16} aria-hidden="true" />
        </button>
        <EditorHistory editor={editor} />
        <button
          onClick={() => editor?.chain().focus().toggleClaim().run()}
          className={editor?.isActive('claim') ? 'active' : ''}
          title="Mark as Claim"
          aria-label="Mark as Claim"
        >
          <CheckCircle size={16} aria-hidden="true" /> Claim
        </button>
        <button
          onClick={() => void onExtractEntities()}
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
        <button type="button" onClick={() => { void onSave(); }} className="primary">{editingEntityId ? 'Update Entity' : 'Save to DB'}</button>
        {editingEntityId && (
          <button type="button" onClick={onCancelEdit} aria-label="Cancel editing">
            Cancel
          </button>
        )}
      </div>
      {showLinkInput && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '4px 0', marginBottom: '8px' }}>
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => { setLinkUrl(e.target.value); }}
            placeholder="https://..."
            onKeyDown={(e) => { if (e.key === 'Enter') setLink(); }}
            style={{ flex: 1, padding: '6px 8px', fontSize: '13px' }}
            aria-label="Link URL"
          />
          <button type="button" onClick={setLink} style={{ padding: '6px 12px', fontSize: '13px' }}>Apply</button>
          <button type="button" onClick={() => { setShowLinkInput(false); setLinkUrl(''); }} style={{ padding: '6px 12px', fontSize: '13px' }}>Cancel</button>
        </div>
      )}
    </>
  );
};

export default EditorToolbar;
