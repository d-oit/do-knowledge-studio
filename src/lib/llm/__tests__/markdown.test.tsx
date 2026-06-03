import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import MarkdownRenderer from '../markdown';

describe('MarkdownRenderer', () => {
  it('renders headings', () => {
    const { container } = render(<MarkdownRenderer content="# Heading 1\n\n## Heading 2" />);
    expect(container.textContent).toContain('Heading 1');
    expect(container.textContent).toContain('Heading 2');
  });

  it('renders lists', () => {
    const { container } = render(<MarkdownRenderer content="- Item 1\n- Item 2" />);
    expect(container.querySelectorAll('li').length).toBeGreaterThan(0);
  });

  it('renders bold and italic', () => {
    const { container } = render(<MarkdownRenderer content="**bold** and *italic*" />);
    expect(container.querySelector('strong')).toHaveTextContent('bold');
    expect(container.querySelector('em')).toHaveTextContent('italic');
  });

  it('renders code blocks', () => {
    const { container } = render(<MarkdownRenderer content="```\ncode block\n```" />);
    expect(container.querySelector('pre')).not.toBeNull();
  });

  it('sanitizes dangerous HTML', () => {
    const { container } = render(<MarkdownRenderer content='<script>alert("xss")</script>**safe**' />);
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('strong')).toHaveTextContent('safe');
  });

  it('handles links with target="_blank"', () => {
      const { container } = render(<MarkdownRenderer content="[link](https://example.com)" />);
      const a = container.querySelector('a');
      expect(a).toHaveAttribute('href', 'https://example.com');
      expect(a).toHaveAttribute('target', '_blank');
  });
});
