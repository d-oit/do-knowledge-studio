import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import MarkdownRenderer from '../markdown';

describe('MarkdownRenderer', () => {
  it('should render heading levels h1-h6', () => {
    const { container } = render(<MarkdownRenderer content="# Heading 1" />);
    expect(container.querySelector('h1')).toBeTruthy();
    expect(container.querySelector('h1')?.textContent).toBe('Heading 1');
  });

  it('should render h2', () => {
    const { container } = render(<MarkdownRenderer content="## Heading 2" />);
    expect(container.querySelector('h2')).toBeTruthy();
  });

  it('should render h3', () => {
    const { container } = render(<MarkdownRenderer content="### Heading 3" />);
    expect(container.querySelector('h3')).toBeTruthy();
  });

  it('should render unordered lists', () => {
    const { container } = render(
      <MarkdownRenderer content={'- Item 1\n- Item 2\n- Item 3'} />
    );
    const list = container.querySelector('ul');
    expect(list).toBeTruthy();
    const items = container.querySelectorAll('li');
    expect(items.length).toBe(3);
  });

  it('should render ordered lists', () => {
    const { container } = render(
      <MarkdownRenderer content={'1. First\n2. Second\n3. Third'} />
    );
    const list = container.querySelector('ol');
    expect(list).toBeTruthy();
    const items = container.querySelectorAll('li');
    expect(items.length).toBe(3);
  });

  it('should render fenced code blocks', () => {
    const { container } = render(
      <MarkdownRenderer content={'```\nconst x = 1;\n```'} />
    );
    const pre = container.querySelector('pre');
    expect(pre).toBeTruthy();
    const code = container.querySelector('code');
    expect(code).toBeTruthy();
  });

  it('should render inline bold', () => {
    const { container } = render(<MarkdownRenderer content="**bold text**" />);
    const strong = container.querySelector('strong');
    expect(strong).toBeTruthy();
    expect(strong?.textContent).toBe('bold text');
  });

  it('should render inline italic', () => {
    const { container } = render(<MarkdownRenderer content="*italic text*" />);
    const em = container.querySelector('em');
    expect(em).toBeTruthy();
    expect(em?.textContent).toBe('italic text');
  });

  it('should render strikethrough', () => {
    const { container } = render(<MarkdownRenderer content="~~strikethrough~~" />);
    const del = container.querySelector('del');
    expect(del).toBeTruthy();
    expect(del?.textContent).toBe('strikethrough');
  });

  it('should render inline code', () => {
    const { container } = render(<MarkdownRenderer content="Text with `code` inline" />);
    // The markdown renderer wraps inline code in <code> tags
    // Check if the content contains the code element
    const content = container.querySelector('.markdown-content');
    expect(content).toBeTruthy();
    expect(content?.innerHTML).toContain('<code>');
  });

  it('should render links with target="_blank"', () => {
    const { container } = render(
      <MarkdownRenderer content="[link](https://example.com)" />
    );
    const link = container.querySelector('a');
    expect(link).toBeTruthy();
    expect(link?.getAttribute('href')).toBe('https://example.com');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('should sanitize XSS vectors', () => {
    const { container } = render(
      <MarkdownRenderer content="<script>alert('xss')</script>" />
    );
    const script = container.querySelector('script');
    expect(script).toBeFalsy();
  });

  it('should handle empty input', () => {
    const { container } = render(<MarkdownRenderer content="" />);
    expect(container.querySelector('.markdown-content')).toBeTruthy();
  });

  it('should handle unclosed code blocks', () => {
    const { container } = render(
      <MarkdownRenderer content={'Some text\n```\nconst x = 1;'} />
    );
    // The unclosed code block should still render as a paragraph
    const p = container.querySelector('p');
    expect(p).toBeTruthy();
  });

  it('should render bold and italic together', () => {
    const { container } = render(
      <MarkdownRenderer content="***bold and italic***" />
    );
    const strong = container.querySelector('strong');
    const em = container.querySelector('em');
    expect(strong).toBeTruthy();
    expect(em).toBeTruthy();
  });
});
