import { describe, it, expect, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { MentionExtension } from '../MentionExtension';
import { ClaimExtension } from '../ClaimExtension';

let editor: Editor;

function createEditor(extensions = []) {
  editor = new Editor({
    extensions: [StarterKit, ...extensions],
    content: '',
  });
  return editor;
}

afterEach(() => {
  editor?.destroy();
});

describe('MentionExtension', () => {
  it('registers mention mark', () => {
    const editor = createEditor([MentionExtension]);
    expect(editor.extensionManager.extensions.find(e => e.name === 'mention')).toBeDefined();
  });

  it('can set a mention mark', () => {
    const editor = createEditor([MentionExtension]);
    editor.commands.setContent('<p>Test</p>');
    editor.commands.setTextSelection({ from: 1, to: 5 });
    editor.commands.setMention({ entityId: 'e1', entityName: 'Entity 1' });
    const html = editor.getHTML();
    expect(html).toContain('data-entity-id="e1"');
    expect(html).toContain('data-entity-name="Entity 1"');
  });

  it('can toggle a mention mark', () => {
    const editor = createEditor([MentionExtension]);
    editor.commands.setContent('<p>Test</p>');
    editor.commands.setTextSelection({ from: 1, to: 5 });
    editor.commands.toggleMention({ entityId: 'e1', entityName: 'Entity 1' });
    const html = editor.getHTML();
    expect(html).toContain('data-entity-id="e1"');
    editor.commands.setTextSelection({ from: 1, to: 5 });
    editor.commands.toggleMention({ entityId: 'e1', entityName: 'Entity 1' });
    const htmlAfter = editor.getHTML();
    expect(htmlAfter).not.toContain('data-entity-id="e1"');
  });

  it('can unset a mention mark', () => {
    const editor = createEditor([MentionExtension]);
    editor.commands.setContent('<p>Test</p>');
    editor.commands.setMention({ entityId: 'e1', entityName: 'Entity 1' });
    editor.commands.unsetMention();
    const html = editor.getHTML();
    expect(html).not.toContain('data-entity-id');
  });

  it('parses HTML with mention attributes', () => {
    const editor = createEditor([MentionExtension]);
    editor.commands.setContent('<p><span data-entity-id="e1" data-entity-name="Entity 1">text</span></p>');
    const json = editor.getJSON();
    const marks = json.content?.[0].content?.[0].marks as Array<{ type: string; attrs?: Record<string, string> }> | undefined;
    expect(marks).toBeDefined();
    const mentionMark = marks?.find(m => m.type === 'mention');
    expect(mentionMark).toBeDefined();
    expect(mentionMark?.attrs).toEqual({ entityId: 'e1', entityName: 'Entity 1' });
  });

  it('applies CSS class to rendered mention', () => {
    const editor = createEditor([MentionExtension]);
    editor.commands.setContent('<p>Test</p>');
    editor.commands.setTextSelection({ from: 1, to: 5 });
    editor.commands.setMention({ entityId: 'e1', entityName: 'Entity 1' });
    const html = editor.getHTML();
    expect(html).toContain('class="entity-mention"');
  });
});

describe('ClaimExtension', () => {
  it('registers claim mark', () => {
    const editor = createEditor([ClaimExtension]);
    expect(editor.extensionManager.extensions.find(e => e.name === 'claim')).toBeDefined();
  });

  it('can set a claim mark', () => {
    const editor = createEditor([ClaimExtension]);
    editor.commands.setContent('<p>Test</p>');
    editor.commands.setTextSelection({ from: 1, to: 5 });
    editor.commands.setClaim();
    const html = editor.getHTML();
    expect(html).toContain('knowledge-claim');
  });

  it('can toggle a claim mark', () => {
    const editor = createEditor([ClaimExtension]);
    editor.commands.setContent('<p>Test</p>');
    editor.commands.setTextSelection({ from: 1, to: 5 });
    editor.commands.toggleClaim();
    expect(editor.getHTML()).toContain('knowledge-claim');
    editor.commands.setTextSelection({ from: 1, to: 5 });
    editor.commands.toggleClaim();
    expect(editor.getHTML()).not.toContain('knowledge-claim');
  });

  it('can unset a claim mark', () => {
    const editor = createEditor([ClaimExtension]);
    editor.commands.setContent('<p>Test</p>');
    editor.commands.setClaim();
    editor.commands.unsetClaim();
    expect(editor.getHTML()).not.toContain('knowledge-claim');
  });

  it('parses HTML with claim class', () => {
    const editor = createEditor([ClaimExtension]);
    editor.commands.setContent('<p><span class="knowledge-claim">important fact</span></p>');
    const json = editor.getJSON();
    const marks = json.content?.[0].content?.[0].marks as Array<{ type: string }> | undefined;
    expect(marks).toBeDefined();
    const claimMark = marks?.find(m => m.type === 'claim');
    expect(claimMark).toBeDefined();
  });

  it('applies CSS class to rendered claim', () => {
    const editor = createEditor([ClaimExtension]);
    editor.commands.setContent('<p>Test</p>');
    editor.commands.setTextSelection({ from: 1, to: 5 });
    editor.commands.setClaim();
    const html = editor.getHTML();
    expect(html).toContain('class="knowledge-claim"');
  });
});
