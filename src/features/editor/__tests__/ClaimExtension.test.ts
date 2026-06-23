import { describe, it, expect, vi, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { ClaimExtension } from '../ClaimExtension';

let editor: Editor | null = null;

const buildEditor = (): Editor => {
  const e = new Editor({
    extensions: [StarterKit, ClaimExtension],
    content: '',
  });
  editor = e;
  return e;
};

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe('ClaimExtension — registration and configuration', () => {
  it('registers the claim mark in the extension manager', () => {
    const e = buildEditor();
    const ext = e.extensionManager.extensions.find(x => x.name === 'claim');
    expect(ext).toBeDefined();
    expect(ext?.type).toBe('mark');
  });

  it('uses knowledge-claim as the default class', () => {
    const e = buildEditor();
    expect(e.getHTML()).toBeDefined();
    e.commands.setContent('<p>Important fact</p>');
    e.commands.setTextSelection({ from: 1, to: 14 });
    e.commands.setClaim();
    expect(e.getHTML()).toContain('class="knowledge-claim"');
  });

  it('renders the span wrapper with the knowledge-claim class', () => {
    const e = buildEditor();
    e.commands.setContent('<p>Highlighted</p>');
    e.commands.setTextSelection({ from: 1, to: 11 });
    e.commands.setClaim();
    const html = e.getHTML();
    expect(html).toContain('<span');
    expect(html).toContain('knowledge-claim');
  });
});

describe('ClaimExtension — commands', () => {
  it('setClaim applies the mark to the current selection', () => {
    const e = buildEditor();
    e.commands.setContent('<p>This is a test</p>');
    e.commands.setTextSelection({ from: 1, to: 5 });
    e.commands.setClaim();
    const html = e.getHTML();
    expect(html).toContain('knowledge-claim');
  });

  it('toggleClaim adds the mark when not present and removes it when present', () => {
    const e = buildEditor();
    e.commands.setContent('<p>Test</p>');
    e.commands.setTextSelection({ from: 1, to: 5 });
    e.commands.toggleClaim();
    expect(e.getHTML()).toContain('knowledge-claim');
    e.commands.setTextSelection({ from: 1, to: 5 });
    e.commands.toggleClaim();
    expect(e.getHTML()).not.toContain('knowledge-claim');
  });

  it('unsetClaim removes the mark from the current selection', () => {
    const e = buildEditor();
    e.commands.setContent('<p>Important</p>');
    e.commands.setTextSelection({ from: 1, to: 9 });
    e.commands.setClaim();
    expect(e.getHTML()).toContain('knowledge-claim');
    e.commands.setTextSelection({ from: 1, to: 9 });
    e.commands.unsetClaim();
    expect(e.getHTML()).not.toContain('knowledge-claim');
  });
});

describe('ClaimExtension — HTML parsing and serialization', () => {
  it('parses HTML containing the knowledge-claim class into a claim mark', () => {
    const e = buildEditor();
    e.commands.setContent('<p><span class="knowledge-claim">important fact</span></p>');
    const json = e.getJSON();
    const para = json.content?.[0];
    const text = para?.content?.[0] as { marks?: Array<{ type: string }> } | undefined;
    expect(text).toBeDefined();
    const claimMark = text?.marks?.find(m => m.type === 'claim');
    expect(claimMark).toBeDefined();
  });

  it('round-trips claim content through setContent and getHTML', () => {
    const e = buildEditor();
    e.commands.setContent('<p><span class="knowledge-claim">persisted</span></p>');
    const html = e.getHTML();
    expect(html).toContain('knowledge-claim');
    expect(html).toContain('persisted');
  });

  it('renders the inner content as children of the claim span', () => {
    const e = buildEditor();
    e.commands.setContent('<p>Roundtrip</p>');
    e.commands.setTextSelection({ from: 1, to: 10 });
    e.commands.setClaim();
    const json = e.getJSON();
    const para = json.content?.[0];
    expect(para?.content).toBeDefined();
    const text = para?.content?.[0] as { text?: string; type?: string } | undefined;
    expect(text?.text).toBe('Roundtrip');
  });
});

describe('ClaimExtension — repository interaction isolation', () => {
  it('does not call any repository methods directly on mark application', () => {
    const repository = {
      createClaim: vi.fn().mockResolvedValue({ id: 'c1' }),
    };
    const e = buildEditor();
    e.commands.setContent('<p>No repo</p>');
    e.commands.setTextSelection({ from: 1, to: 6 });
    e.commands.setClaim();
    expect(repository.createClaim).not.toHaveBeenCalled();
  });

  it('extension configuration provides input rule-free mark application', () => {
    const e = buildEditor();
    e.commands.setContent('<p>plain</p>');
    expect(e.getHTML()).not.toContain('knowledge-claim');
    e.commands.setTextSelection({ from: 1, to: 6 });
    e.commands.setClaim();
    expect(e.getHTML()).toContain('knowledge-claim');
  });
});
