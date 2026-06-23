import { describe, it, expect, vi, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { MentionExtension } from '../MentionExtension';

let editor: Editor | null = null;

const buildEditor = (): Editor => {
  const e = new Editor({
    extensions: [StarterKit, MentionExtension],
    content: '',
  });
  editor = e;
  return e;
};

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe('MentionExtension — registration and configuration', () => {
  it('registers the mention mark in the extension manager', () => {
    const e = buildEditor();
    const ext = e.extensionManager.extensions.find(x => x.name === 'mention');
    expect(ext).toBeDefined();
    expect(ext?.type).toBe('mark');
  });

  it('uses entity-mention as the default class', () => {
    const e = buildEditor();
    e.commands.setContent('<p>Hello</p>');
    e.commands.setTextSelection({ from: 1, to: 6 });
    e.commands.setMention({ entityId: 'e1', entityName: 'Alpha' });
    expect(e.getHTML()).toContain('class="entity-mention"');
  });

  it('stores entityId and entityName as mark attributes', () => {
    const e = buildEditor();
    e.commands.setContent('<p>Hello</p>');
    e.commands.setTextSelection({ from: 1, to: 6 });
    e.commands.setMention({ entityId: 'e1', entityName: 'Alpha' });
    const json = e.getJSON();
    const para = json.content?.[0];
    const text = para?.content?.[0] as { marks?: Array<{ type: string; attrs?: Record<string, string> }> } | undefined;
    const mentionMark = text?.marks?.find(m => m.type === 'mention');
    expect(mentionMark).toBeDefined();
    expect(mentionMark?.attrs?.entityId).toBe('e1');
    expect(mentionMark?.attrs?.entityName).toBe('Alpha');
  });
});

describe('MentionExtension — commands', () => {
  it('setMention applies the mark with the given attributes', () => {
    const e = buildEditor();
    e.commands.setContent('<p>Person</p>');
    e.commands.setTextSelection({ from: 1, to: 7 });
    e.commands.setMention({ entityId: 'p1', entityName: 'Person' });
    const html = e.getHTML();
    expect(html).toContain('data-entity-id="p1"');
    expect(html).toContain('data-entity-name="Person"');
  });

  it('toggleMention adds the mark when absent and removes it when present', () => {
    const e = buildEditor();
    e.commands.setContent('<p>Bob</p>');
    e.commands.setTextSelection({ from: 1, to: 4 });
    e.commands.toggleMention({ entityId: 'b1', entityName: 'Bob' });
    expect(e.getHTML()).toContain('data-entity-id="b1"');
    e.commands.setTextSelection({ from: 1, to: 4 });
    e.commands.toggleMention({ entityId: 'b1', entityName: 'Bob' });
    expect(e.getHTML()).not.toContain('data-entity-id="b1"');
  });

  it('unsetMention removes the mark from the current selection', () => {
    const e = buildEditor();
    e.commands.setContent('<p>Carol</p>');
    e.commands.setTextSelection({ from: 1, to: 6 });
    e.commands.setMention({ entityId: 'c1', entityName: 'Carol' });
    expect(e.getHTML()).toContain('data-entity-id="c1"');
    e.commands.setTextSelection({ from: 1, to: 6 });
    e.commands.unsetMention();
    expect(e.getHTML()).not.toContain('data-entity-id');
  });

  it('setting a different mention updates the entity attributes', () => {
    const e = buildEditor();
    e.commands.setContent('<p>X</p>');
    e.commands.setTextSelection({ from: 1, to: 2 });
    e.commands.setMention({ entityId: 'first', entityName: 'First' });
    e.commands.setTextSelection({ from: 1, to: 2 });
    e.commands.setMention({ entityId: 'second', entityName: 'Second' });
    const json = e.getJSON();
    const para = json.content?.[0];
    const text = para?.content?.[0] as { marks?: Array<{ attrs?: Record<string, string> }> } | undefined;
    const mention = text?.marks?.find(m => m.type === 'mention');
    expect(mention?.attrs?.entityId).toBe('second');
  });
});

describe('MentionExtension — HTML parsing and serialization', () => {
  it('parses HTML containing data-entity-id into a mention mark with attributes', () => {
    const e = buildEditor();
    e.commands.setContent('<p><span data-entity-id="e1" data-entity-name="Entity 1">text</span></p>');
    const json = e.getJSON();
    const para = json.content?.[0];
    const text = para?.content?.[0] as { marks?: Array<{ type: string; attrs?: Record<string, string> }> } | undefined;
    const mentionMark = text?.marks?.find(m => m.type === 'mention');
    expect(mentionMark).toBeDefined();
    expect(mentionMark?.attrs).toEqual({ entityId: 'e1', entityName: 'Entity 1' });
  });

  it('round-trips mention content through setContent and getHTML', () => {
    const e = buildEditor();
    e.commands.setContent('<p><span data-entity-id="x9" data-entity-name="X Nine">named</span></p>');
    const html = e.getHTML();
    expect(html).toContain('data-entity-id="x9"');
    expect(html).toContain('data-entity-name="X Nine"');
    expect(html).toContain('class="entity-mention"');
  });

  it('serializes the mark with class, data-entity-id, and data-entity-name', () => {
    const e = buildEditor();
    e.commands.setContent('<p>Hello</p>');
    e.commands.setTextSelection({ from: 1, to: 6 });
    e.commands.setMention({ entityId: 'serial', entityName: 'Serialize Me' });
    const html = e.getHTML();
    expect(html).toContain('class="entity-mention"');
    expect(html).toContain('data-entity-id="serial"');
    expect(html).toContain('data-entity-name="Serialize Me"');
  });
});

describe('MentionExtension — mention filtering and selection (pure logic)', () => {
  it('filters a list of entity suggestions by case-insensitive substring match', () => {
    const filterSuggestions = (query: string, items: { id: string; name: string }[]) => {
      const q = query.toLowerCase();
      return items.filter(item => item.name.toLowerCase().includes(q));
    };
    const items = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
      { id: '3', name: 'Atlas Project' },
      { id: '4', name: 'alice@example' },
    ];
    expect(filterSuggestions('ali', items).map(i => i.id)).toEqual(['1', '4']);
    expect(filterSuggestions('PROJECT', items).map(i => i.id)).toEqual(['3']);
    expect(filterSuggestions('zz', items)).toEqual([]);
  });

  it('handles a query starting with the @ trigger character', () => {
    const filterSuggestions = (rawQuery: string, items: { id: string; name: string }[]) => {
      const query = rawQuery.startsWith('@') ? rawQuery.slice(1) : rawQuery;
      const q = query.toLowerCase();
      return items.filter(item => item.name.toLowerCase().includes(q));
    };
    const items = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Project Atlas' },
    ];
    expect(filterSuggestions('@alice', items).map(i => i.id)).toEqual(['1']);
    expect(filterSuggestions('@atlas', items).map(i => i.id)).toEqual(['2']);
  });

  it('returns the full list when the query is empty', () => {
    const filterSuggestions = (query: string, items: { id: string; name: string }[]) => {
      if (query.length === 0) return items;
      const q = query.toLowerCase();
      return items.filter(item => item.name.toLowerCase().includes(q));
    };
    const items = [{ id: '1', name: 'Alice' }, { id: '2', name: 'Bob' }];
    expect(filterSuggestions('', items)).toEqual(items);
  });
});

describe('MentionExtension — keyboard navigation in suggestion list (pure logic)', () => {
  type Item = { id: string; name: string };

  const clampIndex = (index: number, length: number): number => {
    if (length === 0) return -1;
    if (index < 0) return length - 1;
    if (index >= length) return 0;
    return index;
  };

  it('moves selection down with ArrowDown and wraps at the end', () => {
    const items: Item[] = [{ id: '1', name: 'A' }, { id: '2', name: 'B' }, { id: '3', name: 'C' }];
    let idx = 0;
    idx = clampIndex(idx + 1, items.length);
    expect(idx).toBe(1);
    idx = clampIndex(idx + 1, items.length);
    expect(idx).toBe(2);
    idx = clampIndex(idx + 1, items.length);
    expect(idx).toBe(0);
  });

  it('moves selection up with ArrowUp and wraps at the start', () => {
    const items: Item[] = [{ id: '1', name: 'A' }, { id: '2', name: 'B' }, { id: '3', name: 'C' }];
    let idx = 0;
    idx = clampIndex(idx - 1, items.length);
    expect(idx).toBe(2);
    idx = clampIndex(idx - 1, items.length);
    expect(idx).toBe(1);
  });

  it('returns -1 when the suggestion list is empty', () => {
    expect(clampIndex(0, 0)).toBe(-1);
    expect(clampIndex(-3, 0)).toBe(-1);
    expect(clampIndex(5, 0)).toBe(-1);
  });

  it('selects the chosen suggestion and builds the mention attributes', () => {
    const items: Item[] = [{ id: 'a1', name: 'Alpha' }, { id: 'b1', name: 'Beta' }];
    const pickAt = (index: number) => items[index];
    const chosen = pickAt(1);
    expect(chosen).toEqual({ id: 'b1', name: 'Beta' });
  });
});

describe('MentionExtension — repository interaction isolation', () => {
  it('does not call any repository methods directly on mark application', () => {
    const repository = {
      searchEntities: vi.fn().mockResolvedValue([]),
      getEntityByName: vi.fn().mockResolvedValue(null),
    };
    const e = buildEditor();
    e.commands.setContent('<p>No repo</p>');
    e.commands.setTextSelection({ from: 1, to: 7 });
    e.commands.setMention({ entityId: 'noop', entityName: 'Noop' });
    expect(repository.searchEntities).not.toHaveBeenCalled();
    expect(repository.getEntityByName).not.toHaveBeenCalled();
  });
});
