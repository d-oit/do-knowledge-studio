// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import MarkdownRenderer from '../markdown';

// sanitizeHtml (from src/lib/security.ts) only allows:
// b, i, em, strong, a, ul, ol, li, p, br, span, div, h1-h6
// Tags like <code>, <pre>, <del> are stripped but content is preserved.

describe('MarkdownRenderer', () => {
  it('renders plain text in a paragraph', () => {
    const { container } = render(<MarkdownRenderer content="Hello world" />);
    expect(container.textContent).toContain('Hello world');
  });

  it('renders bold text via **syntax**', () => {
    const { container } = render(<MarkdownRenderer content="**bold**" />);
    const strong = container.querySelector('strong');
    expect(strong?.textContent).toBe('bold');
  });

  it('renders italic text via *syntax*', () => {
    const { container } = render(<MarkdownRenderer content="*italic*" />);
    const em = container.querySelector('em');
    expect(em?.textContent).toBe('italic');
  });

  it('renders bold italic text via ***syntax***', () => {
    const { container } = render(<MarkdownRenderer content="***both***" />);
    const strong = container.querySelector('strong');
    const em = container.querySelector('em');
    expect(strong).toBeDefined();
    expect(em).toBeDefined();
  });

  it('renders inline code content (tag stripped by sanitizer)', () => {
    const { container } = render(<MarkdownRenderer content="use `console.log` now" />);
    // <code> is stripped by sanitizeHtml but text content is preserved
    expect(container.textContent).toContain('console.log');
  });

  it('renders links with target=_blank and rel=noopener', () => {
    const { container } = render(<MarkdownRenderer content="[click](https://example.com)" />);
    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://example.com');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link?.textContent).toBe('click');
  });

  it('renders strikethrough content (del tag stripped by sanitizer)', () => {
    const { container } = render(<MarkdownRenderer content="~~deleted~~" />);
    // <del> is stripped by sanitizeHtml but text content is preserved
    expect(container.textContent).toContain('deleted');
  });

  it('renders h1 header', () => {
    const { container } = render(<MarkdownRenderer content="# H1" />);
    const h1 = container.querySelector('h1');
    expect(h1?.textContent).toBe('H1');
  });

  it('renders h2 header', () => {
    const { container } = render(<MarkdownRenderer content="## H2" />);
    const h2 = container.querySelector('h2');
    expect(h2?.textContent).toBe('H2');
  });

  it('renders h3 header', () => {
    const { container } = render(<MarkdownRenderer content="### H3" />);
    const h3 = container.querySelector('h3');
    expect(h3?.textContent).toBe('H3');
  });

  it('renders unordered lists', () => {
    const { container } = render(<MarkdownRenderer content={"- item 1\n- item 2"} />);
    const ul = container.querySelector('ul');
    expect(ul).toBeDefined();
    const items = container.querySelectorAll('li');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toBe('item 1');
    expect(items[1].textContent).toBe('item 2');
  });

  it('renders ordered lists', () => {
    const { container } = render(<MarkdownRenderer content={"1. first\n2. second"} />);
    const ol = container.querySelector('ol');
    expect(ol).toBeDefined();
    const items = container.querySelectorAll('li');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toBe('first');
    expect(items[1].textContent).toBe('second');
  });

  it('renders code block content (pre tag stripped by sanitizer)', () => {
    const { container } = render(<MarkdownRenderer content={"```\nconst x = 1;\n```"} />);
    // <pre><code> are stripped by sanitizeHtml but text content is preserved
    expect(container.textContent).toContain('const x = 1;');
  });

  it('escapes HTML in code blocks to prevent XSS', () => {
    const { container } = render(<MarkdownRenderer content={'```<script>alert("xss")</script>```'} />);
    // The raw HTML should be escaped and never rendered as actual HTML
    expect(container.innerHTML).not.toContain('<script>');
  });

  it('escapes HTML in regular text', () => {
    const { container } = render(<MarkdownRenderer content={'<img src=x onerror=alert(1)>'} />);
    expect(container.innerHTML).not.toContain('<img');
    expect(container.innerHTML).toContain('&lt;');
  });

  it('handles empty content', () => {
    const { container } = render(<MarkdownRenderer content="" />);
    expect(container.querySelector('.markdown-content')).toBeDefined();
  });

  it('renders underscore bold __text__', () => {
    const { container } = render(<MarkdownRenderer content="__bold__" />);
    const strong = container.querySelector('strong');
    expect(strong?.textContent).toBe('bold');
  });

  it('renders underscore italic _text_', () => {
    const { container } = render(<MarkdownRenderer content="_italic_" />);
    const em = container.querySelector('em');
    expect(em?.textContent).toBe('italic');
  });
});
