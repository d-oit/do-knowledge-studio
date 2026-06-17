/**
 * Unit tests for the MentionExtension TipTap mark.
 */

import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { MentionExtension } from '../MentionExtension';

function makeEditor(): Editor {
  return new Editor({
    extensions: [StarterKit, MentionExtension],
    content: '<p>Hello world</p>',
  });
}

describe('MentionExtension', () => {
  it('exposes the expected name', () => {
    expect(MentionExtension.name).toBe('mention');
  });

  it('registers the entity-mention class as default HTMLAttributes', () => {
    const opts = MentionExtension.config.addOptions?.call({}) as {
      HTMLAttributes: { class: string };
    };
    expect(opts.HTMLAttributes.class).toBe('entity-mention');
  });

  it('exposes entityId and entityName attributes', () => {
    const attrs = MentionExtension.config.addAttributes?.call({}) as Record<string, unknown>;
    expect(attrs).toHaveProperty('entityId');
    expect(attrs).toHaveProperty('entityName');
  });

  it('renders a mention with data-entity-id and data-entity-name', () => {
    const editor = makeEditor();
    editor.commands.setTextSelection({ from: 1, to: 5 });
    const ok = editor.commands.setMention({ entityId: 'ent-1', entityName: 'Alpha' });
    expect(ok).toBe(true);
    const html = editor.getHTML();
    expect(html).toContain('data-entity-id="ent-1"');
    expect(html).toContain('data-entity-name="Alpha"');
    editor.destroy();
  });

  it('parses span[data-entity-id] back into a mention mark', () => {
    const editor = new Editor({
      extensions: [StarterKit, MentionExtension],
      content: '<p><span data-entity-id="ent-2" data-entity-name="Beta">Beta</span></p>',
    });
    expect(editor.isActive('mention')).toBe(true);
    editor.destroy();
  });

  it('unsets the mention mark', () => {
    const editor = makeEditor();
    editor.commands.setTextSelection({ from: 1, to: 5 });
    editor.commands.setMention({ entityId: 'ent-3', entityName: 'Gamma' });
    expect(editor.isActive('mention')).toBe(true);
    editor.commands.unsetMention();
    expect(editor.isActive('mention')).toBe(false);
    editor.destroy();
  });
});
