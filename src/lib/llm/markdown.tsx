import React from 'react';
import { sanitizeHtml, escapeHtml } from '../security';

/**
 * A simple markdown-to-HTML converter.
 * Note: This is a basic implementation and does not support all markdown features.
 * It is primarily used for rendering AI assistant responses.
 */
function markdownToHtml(markdown: string): string {
  const lines = markdown.split('\n');
  const html: string[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let inList: 'ul' | 'ol' | null = null;
  let listItems: string[] = [];

  function flushList() {
    if (inList && listItems.length > 0) {
      const tag = inList;
      html.push(`<${tag}>`);
      for (const item of listItems) {
        html.push(`<li>${item}</li>`);
      }
      html.push(`</${tag}>`);
      listItems = [];
      inList = null;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Handle code blocks
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        html.push(`<pre><code>${codeBlockContent.join('\n')}</code></pre>`);
        codeBlockContent = [];
        inCodeBlock = false;
      } else {
        flushList();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(escapeHtml(line));
      continue;
    }

    // Handle headers
    if (/^#{1,6}\s/.test(line)) {
      flushList();
      const match = line.match(/^(#+)\s+(.*)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2];
        html.push(`<h${level}>${processInline(text)}</h${level}>`);
      } else {
        // Fallback for malformed headers
        html.push(`<p>${processInline(line)}</p>`);
      }
    }
    // Handle unordered lists
    else if (/^[-*+]\s/.test(line)) {
      if (inList !== 'ul') {
        flushList();
        inList = 'ul';
      }
      listItems.push(processInline(line.replace(/^[-*+]\s/, '')));
    }
    // Handle ordered lists
    else if (/^\d+[.)]\s/.test(line)) {
      if (inList !== 'ol') {
        flushList();
        inList = 'ol';
      }
      listItems.push(processInline(line.replace(/^\d+[.)]\s/, '')));
    }
    // Handle empty lines (paragraph breaks)
    else if (line.trim() === '') {
      flushList();
      // Only add a closing p tag if the previous line was part of a paragraph
      // This is handled by the paragraph logic below
    }
    // Handle regular text
    else {
      flushList();
      const processedLine = processInline(line);
      const isFirstLineOfParagraph = i === 0 || lines[i - 1].trim() === '' || lines[i - 1].startsWith('#');

      if (isFirstLineOfParagraph) {
        html.push(`<p>${processedLine}`);
      } else {
        html.push(`<br>${processedLine}`);
      }

      const isLastLineOfParagraph = i + 1 >= lines.length || lines[i + 1].trim() === '' || lines[i + 1].startsWith('#');
      if (isLastLineOfParagraph) {
        html.push('</p>');
      }
    }
  }

  // Cleanup any open code blocks or lists
  if (inCodeBlock) {
    html.push(`<pre><code>${codeBlockContent.join('\n')}</code></pre>`);
  }
  flushList();

  return html.join('\n');
}

/**
 * Processes inline markdown syntax (links, bold, italic, code).
 * All text is escaped first to prevent XSS, and then HTML tags are inserted.
 */
function processInline(text: string): string {
  const escaped = escapeHtml(text);
  let result = escaped;

  // Replace patterns using a function to avoid issues with special characters like '$' and '&'
  // in the replacement string or captured groups.
  // We use the function form of replace to ensure captured groups are treated as literal strings.

  // Links: [text](url)
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, g1, g2) =>
    `<a href="${g2}" target="_blank" rel="noopener noreferrer">${g1}</a>`
  );

  // Inline code: `code`
  result = result.replace(/`([^`]+)`/g, (_, g1) => `<code>${g1}</code>`);

  // Bold and Italic: ***text***
  result = result.replace(/\*\*\*(.+?)\*\*\*/g, (_, g1) => `<strong><em>${g1}</em></strong>`);
  result = result.replace(/___(.+?)___/g, (_, g1) => `<strong><em>${g1}</em></strong>`);

  // Bold: **text** or __text__
  result = result.replace(/\*\*(.+?)\*\*/g, (_, g1) => `<strong>${g1}</strong>`);
  result = result.replace(/__(.+?)__/g, (_, g1) => `<strong>${g1}</strong>`);

  // Italic: *text* or _text_
  result = result.replace(/\*(.+?)\*/g, (_, g1) => `<em>${g1}</em>`);
  result = result.replace(/_(.+?)_/g, (_, g1) => `<em>${g1}</em>`);

  // Strikethrough: ~~text~~
  result = result.replace(/~~(.+?)~~/g, (_, g1) => `<del>${g1}</del>`);

  return result;
}

interface MarkdownRendererProps {
  content: string;
}

/**
 * Component to render markdown content safely.
 */
function MarkdownRenderer({ content }: MarkdownRendererProps): React.ReactElement {
  const html = markdownToHtml(content);
  const sanitized = sanitizeHtml(html);
  return <div className="markdown-content" dangerouslySetInnerHTML={{ __html: sanitized }} />;
}

export default MarkdownRenderer;
