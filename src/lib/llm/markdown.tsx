import React from 'react';
import { sanitizeHtml } from '../security';

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

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

    const processedLine = processInline(line);

    if (/^#{1,6}\s/.test(line)) {
      flushList();
      const level = line.match(/^#+/)![0].length;
      const text = line.slice(level).trim();
      html.push(`<h${level}>${processInline(text)}</h${level}>`);
    } else if (/^[-*+]\s/.test(line)) {
      if (inList !== 'ul') {
        flushList();
        inList = 'ul';
      }
      listItems.push(processInline(line.replace(/^[-*+]\s/, '')));
    } else if (/^\d+[.)]\s/.test(line)) {
      if (inList !== 'ol') {
        flushList();
        inList = 'ol';
      }
      listItems.push(processInline(line.replace(/^\d+[.)]\s/, '')));
    } else if (line.trim() === '') {
      flushList();
      if (i > 0 && lines[i - 1].trim() !== '' && !lines[i - 1].startsWith('#')) {
        html.push('</p>');
      }
    } else {
      flushList();
      if (i === 0 || lines[i - 1].trim() === '' || lines[i - 1].startsWith('#')) {
        html.push(`<p>${processedLine}`);
      } else {
        html.push(`<br>${processedLine}`);
      }
      if (i + 1 >= lines.length || lines[i + 1].trim() === '') {
        html.push('</p>');
      }
    }
  }

  if (inCodeBlock) {
    html.push(`<pre><code>${codeBlockContent.join('\n')}</code></pre>`);
  }
  flushList();

  return html.join('\n');
}

function processInline(text: string): string {
  const escaped = escapeHtml(text);
  let result = escaped;
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  result = result.replace(/`([^`]+)`/g, '<code>$1</code>');
  result = result.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
  result = result.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
  result = result.replace(/__(.+?)__/g, '<strong>$1</strong>');
  result = result.replace(/_(.+?)_/g, '<em>$1</em>');
  result = result.replace(/~~(.+?)~~/g, '<del>$1</del>');
  return result;
}

interface MarkdownRendererProps {
  content: string;
}

function MarkdownRenderer({ content }: MarkdownRendererProps): React.ReactElement {
  const html = markdownToHtml(content);
  const sanitized = sanitizeHtml(html);
  return <div className="markdown-content" dangerouslySetInnerHTML={{ __html: sanitized }} />;
}

export default MarkdownRenderer;
