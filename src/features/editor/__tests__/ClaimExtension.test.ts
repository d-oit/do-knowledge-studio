/**
 * Unit tests for the ClaimExtension TipTap mark.
 */

import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { ClaimExtension } from '../ClaimExtension';

function makeEditor(): Editor {
  return new Editor({
    extensions: [StarterKit, ClaimExtension],
    content: '<p>Hello world</p>',
  });
}

describe('ClaimExtension', () => {
  it('exposes the expected name', () => {
    const ext = ClaimExtension;
    expect(ext.name).toBe('claim');
  });

  it('registers as a mark with the correct class attribute', () => {
    const ext = ClaimExtension;
    const opts = ext.config.addOptions?.call({}) as { HTMLAttributes: { class: string } };
    expect(opts.HTMLAttributes.class).toBe('knowledge-claim');
  });

  it('renders the claim mark as a span with the knowledge-claim class', () => {
    const editor = makeEditor();
    editor.commands.setContent('<p>Test</p>');
    editor.commands.setTextSelection({ from: 1, to: 5 });
    const ok = editor.commands.setClaim();
    expect(ok).toBe(true);
    const html = editor.getHTML();
    expect(html).toContain('knowledge-claim');
    editor.destroy();
  });

  it('toggles the claim mark on the current selection', () => {
    const editor = makeEditor();
    editor.commands.setTextSelection({ from: 1, to: 5 });
    expect(editor.commands.toggleClaim()).toBe(true);
    expect(editor.isActive('claim')).toBe(true);
    expect(editor.commands.toggleClaim()).toBe(true);
    expect(editor.isActive('claim')).toBe(false);
    editor.destroy();
  });

  it('unsets the claim mark', () => {
    const editor = makeEditor();
    editor.commands.setTextSelection({ from: 1, to: 5 });
    editor.commands.setClaim();
    expect(editor.isActive('claim')).toBe(true);
    editor.commands.unsetClaim();
    expect(editor.isActive('claim')).toBe(false);
    editor.destroy();
  });

  it('parses span[class="knowledge-claim"] back into a claim mark', () => {
    const editor = new Editor({
      extensions: [StarterKit, ClaimExtension],
      content: '<p><span class="knowledge-claim">Source claim</span></p>',
    });
    expect(editor.isActive('claim')).toBe(true);
    editor.destroy();
  });
});
