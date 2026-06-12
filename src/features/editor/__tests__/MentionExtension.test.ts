import { describe, it, expect, beforeEach } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { MentionExtension } from '../MentionExtension';

interface TipTapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

function createEditor(extensions = [StarterKit, MentionExtension]) {
  return new Editor({
    extensions,
    content: '',
  });
}

describe('MentionExtension', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = createEditor();
    return () => editor.destroy();
  });

  it('registers the mention extension with correct name', () => {
    const extension = editor.extensionManager.extensions.find(
      (e) => e.name === 'mention'
    );
    expect(extension).toBeDefined();
  });

  it('has default HTML attributes with class entity-mention', () => {
    const extension = editor.extensionManager.extensions.find(
      (e) => e.name === 'mention'
    );
    expect(extension).toBeDefined();
    expect(extension!.options).toEqual(
      expect.objectContaining({
        HTMLAttributes: expect.objectContaining({
          class: 'entity-mention',
        }) as Record<string, unknown>,
      }) as Record<string, unknown>
    );
  });

  it('has entityId and entityName attributes', () => {
    editor.commands.setContent('<p>Test</p>');
    editor.commands.setTextSelection({ from: 1, to: 5 });
    editor.commands.setMention({
      entityId: 'entity-abc',
      entityName: 'Entity ABC',
    });

    const json = editor.getJSON();
    const marks = json.content?.[0]?.content?.[0]?.marks as TipTapMark[] | undefined;
    expect(marks).toBeDefined();
    expect(marks!.some((m) => m.type === 'mention')).toBe(true);
    const mentionMark = marks!.find((m) => m.type === 'mention');
    expect(mentionMark!.attrs).toEqual(
      expect.objectContaining({
        entityId: 'entity-abc',
        entityName: 'Entity ABC',
      }) as Record<string, unknown>
    );
  });

  it('setMention command applies the mention mark with attributes', () => {
    editor.commands.setContent('<p>Hello</p>');
    editor.commands.setTextSelection({ from: 1, to: 6 });

    const result = editor.commands.setMention({
      entityId: 'entity-123',
      entityName: 'Test Entity',
    });

    expect(result).toBe(true);
    const html = editor.getHTML();
    expect(html).toContain('entity-mention');
    expect(html).toContain('entity-123');
    expect(html).toContain('Test Entity');
  });

  it('toggleMention command toggles the mention mark', () => {
    editor.commands.setContent('<p>Hello</p>');
    editor.commands.setTextSelection({ from: 1, to: 6 });

    editor.commands.toggleMention({
      entityId: 'entity-123',
      entityName: 'Test Entity',
    });
    expect(editor.getHTML()).toContain('entity-mention');

    editor.commands.toggleMention({
      entityId: 'entity-123',
      entityName: 'Test Entity',
    });
    expect(editor.getHTML()).not.toContain('entity-mention');
  });

  it('unsetMention command removes the mention mark', () => {
    editor.commands.setContent('<p>Hello</p>');
    editor.commands.setTextSelection({ from: 1, to: 6 });

    editor.commands.setMention({
      entityId: 'entity-123',
      entityName: 'Test Entity',
    });
    expect(editor.getHTML()).toContain('entity-mention');

    editor.commands.unsetMention();
    expect(editor.getHTML()).not.toContain('entity-mention');
  });

  it('parseHTML recognizes span with data-entity-id', () => {
    editor.commands.setContent(
      '<span data-entity-id="entity-xyz" data-entity-name="XYZ">Mentioned</span>'
    );
    const json = editor.getJSON();
    const marks = json.content?.[0]?.content?.[0]?.marks as TipTapMark[] | undefined;
    expect(marks).toBeDefined();
    expect(marks!.some((m) => m.type === 'mention')).toBe(true);
  });

  it('renderHTML outputs span with entity-mention class and data attributes', () => {
    editor.commands.setContent('<p>Test</p>');
    editor.commands.setTextSelection({ from: 1, to: 5 });
    editor.commands.setMention({
      entityId: 'entity-456',
      entityName: 'My Entity',
    });

    const html = editor.getHTML();
    expect(html).toContain('entity-mention');
    expect(html).toContain('entity-456');
    expect(html).toContain('My Entity');
  });

  it('handles empty entityId and entityName gracefully', () => {
    editor.commands.setContent('<p>Hello</p>');
    editor.commands.setTextSelection({ from: 1, to: 6 });

    expect(() => {
      editor.commands.setMention({
        entityId: '',
        entityName: '',
      });
    }).not.toThrow();
  });
});
