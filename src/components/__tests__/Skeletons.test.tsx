import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  EditorSkeleton,
  GraphSkeleton,
  MindMapSkeleton,
  AISkeleton,
  SearchSkeleton,
  ExportSkeleton,
} from '../Skeletons';

describe('Skeleton components', () => {
  it('renders EditorSkeleton without crashing', () => {
    const { container } = render(<EditorSkeleton />);
    expect(container.querySelector('.skeleton-layout')).not.toBeNull();
    expect(container.querySelectorAll('.skeleton-rect').length).toBeGreaterThan(0);
  });

  it('renders GraphSkeleton without crashing', () => {
    const { container } = render(<GraphSkeleton />);
    expect(container.querySelector('.skeleton-layout')).not.toBeNull();
    expect(container.querySelectorAll('.skeleton-circle').length).toBeGreaterThan(0);
  });

  it('renders MindMapSkeleton without crashing', () => {
    const { container } = render(<MindMapSkeleton />);
    expect(container.querySelector('.skeleton-layout')).not.toBeNull();
    expect(container.querySelectorAll('.skeleton-rect').length).toBeGreaterThan(0);
  });

  it('renders AISkeleton without crashing', () => {
    const { container } = render(<AISkeleton />);
    expect(container.querySelector('.skeleton-layout')).not.toBeNull();
    expect(container.querySelectorAll('.skeleton-rect').length).toBeGreaterThan(0);
  });

  it('renders SearchSkeleton without crashing', () => {
    const { container } = render(<SearchSkeleton />);
    expect(container.querySelector('.skeleton-layout')).not.toBeNull();
    expect(container.querySelectorAll('.skeleton-rect').length).toBeGreaterThan(0);
  });

  it('renders ExportSkeleton without crashing', () => {
    const { container } = render(<ExportSkeleton />);
    expect(container.querySelector('.skeleton-layout')).not.toBeNull();
    expect(container.querySelectorAll('.skeleton-rect').length).toBeGreaterThan(0);
  });
});
