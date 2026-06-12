import { describe, it, expect, beforeEach } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { ClaimExtension } from '../ClaimExtension';

function createEditor(extensions = [StarterKit, ClaimExtension]) {
  return new Editor({
    extensions,
    content: '',
  });
}

describe('ClaimExtension', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = createEditor();
    return () => editor.destroy();
  });

  it('registers the claim extension with correct name', () => {
    const extension = editor.extensionManager.extensions.find(
      (e) => e.name === 'claim'
    );
    expect(extension).toBeDefined();
  });

  it('has default HTML attributes with class knowledge-claim', () => {
    const extension = editor.extensionManager.extensions.find(
      (e) => e.name === 'claim'
    );
    expect(extension).toBeDefined();
    expect(extension!.options).toEqual(
      expect.objectContaining({
        HTMLAttributes: expect.objectContaining({
          class: 'knowledge-claim',
        }) as Record<string, unknown>,
      }) as Record<string, unknown>
    );
  });

  it('setClaim command applies the claim mark', () => {
    editor.commands.setContent('<p>Hello</p>');
    editor.commands.setTextSelection({ from: 1, to: 6 });
    const result = editor.commands.setClaim();
    expect(result).toBe(true);

    const html = editor.getHTML();
    expect(html).toContain('knowledge-claim');
  });

  it('toggleClaim command toggles the claim mark', () => {
    editor.commands.setContent('<p>Hello</p>');
    editor.commands.setTextSelection({ from: 1, to: 6 });

    editor.commands.toggleClaim();
    expect(editor.getHTML()).toContain('knowledge-claim');

    editor.commands.toggleClaim();
    expect(editor.getHTML()).not.toContain('knowledge-claim');
  });

  it('unsetClaim command removes the claim mark', () => {
    editor.commands.setContent('<p>Hello</p>');
    editor.commands.setTextSelection({ from: 1, to: 6 });

    editor.commands.setClaim();
    expect(editor.getHTML()).toContain('knowledge-claim');

    editor.commands.unsetClaim();
    expect(editor.getHTML()).not.toContain('knowledge-claim');
  });

  it('parseHTML recognizes span with knowledge-claim class', () => {
    editor.commands.setContent('<span class="knowledge-claim">Claimed text</span>');
    const html = editor.getHTML();
    expect(html).toContain('knowledge-claim');
  });

  it('renderHTML outputs span with knowledge-claim class', () => {
    editor.commands.setContent('<p>Test</p>');
    editor.commands.setTextSelection({ from: 1, to: 5 });
    editor.commands.setClaim();

    const html = editor.getHTML();
    expect(html).toContain('<span class="knowledge-claim">');
  });

  it('handles empty content without errors', () => {
    expect(() => {
      editor.commands.setClaim();
    }).not.toThrow();
  });
});
