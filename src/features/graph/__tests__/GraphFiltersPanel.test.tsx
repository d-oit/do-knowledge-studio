import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { GraphFiltersPanel } from '../GraphFiltersPanel';
import { EMPTY_GRAPH_FILTERS, type GraphFilters } from '../graph-filters';

const nodeTypes = ['person', 'project', 'note'];
const edgeTypes = ['knows', 'works_on', 'references'];

const renderPanel = (overrides: Partial<GraphFilters> = {}, onChange?: (filters: GraphFilters) => void) => {
  const cb: (filters: GraphFilters) => void = onChange ?? (() => undefined);
  const filters: GraphFilters = { ...EMPTY_GRAPH_FILTERS, ...overrides };
  return {
    filters,
    onChange: cb,
    ...render(
      <GraphFiltersPanel
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        filters={filters}
        onChange={cb}
      />,
    ),
  };
};

describe('GraphFiltersPanel', () => {
  it('renders the type, relation, search, and degree sections', () => {
    renderPanel();
    expect(screen.getByText('Type')).toBeDefined();
    expect(screen.getByText('Relation')).toBeDefined();
    expect(screen.getByText('Node search')).toBeDefined();
    expect(screen.getByText('Min connections')).toBeDefined();
  });

  it('renders one checkbox per node type and per relation', () => {
    renderPanel();
    for (const t of nodeTypes) {
      expect(screen.getByLabelText(`Filter by type ${t}`)).toBeDefined();
    }
    for (const r of edgeTypes) {
      expect(screen.getByLabelText(`Filter by relation ${r}`)).toBeDefined();
    }
  });

  it('toggles a node type filter on click', () => {
    let next: GraphFilters | null = null;
    const onChange = (f: GraphFilters) => { next = f; };
    renderPanel({}, onChange);
    fireEvent.click(screen.getByLabelText('Filter by type person'));
    expect(next).not.toBeNull();
    expect(next!.typeFilter.has('person')).toBe(true);
    expect(next!.typeFilter.size).toBe(1);
  });

  it('toggles a relation filter on click', () => {
    let next: GraphFilters | null = null;
    const onChange = (f: GraphFilters) => { next = f; };
    renderPanel({}, onChange);
    fireEvent.click(screen.getByLabelText('Filter by relation knows'));
    expect(next).not.toBeNull();
    expect(next!.relationFilter.has('knows')).toBe(true);
  });

  it('updates node search input', () => {
    let next: GraphFilters | null = null;
    const onChange = (f: GraphFilters) => { next = f; };
    renderPanel({}, onChange);
    fireEvent.change(screen.getByLabelText('Search nodes by label'), { target: { value: 'alpha' } });
    expect(next).not.toBeNull();
    expect(next!.nodeSearch).toBe('alpha');
  });

  it('updates the min-degree filter when a chip is clicked', () => {
    let next: GraphFilters | null = null;
    const onChange = (f: GraphFilters) => { next = f; };
    renderPanel({}, onChange);
    fireEvent.click(screen.getByLabelText('Show nodes with at least 2 connections'));
    expect(next).not.toBeNull();
    expect(next!.minDegree).toBe(2);
  });

  it('hides the reset button when no filters are active', () => {
    renderPanel();
    expect(screen.queryByText('Reset filters')).toBeNull();
  });

  it('shows the reset button when a filter is active and clears on click', () => {
    let next: GraphFilters | null = null;
    const onChange = (f: GraphFilters) => { next = f; };
    renderPanel({ typeFilter: new Set(['person']) }, onChange);
    const reset = screen.getByText('Reset filters');
    expect(reset).toBeDefined();
    fireEvent.click(reset);
    expect(next).not.toBeNull();
    expect(next!.typeFilter.size).toBe(0);
    expect(next!.relationFilter.size).toBe(0);
    expect(next!.nodeSearch).toBe('');
    expect(next!.minDegree).toBe(0);
  });

  it('displays the empty state when there are no node types', () => {
    render(
      <GraphFiltersPanel
        nodeTypes={[]}
        edgeTypes={edgeTypes}
        filters={EMPTY_GRAPH_FILTERS}
        onChange={vi.fn() as (f: GraphFilters) => void}
      />,
    );
    expect(screen.getByText('No node types yet')).toBeDefined();
  });

  it('displays the empty state when there are no edge types', () => {
    render(
      <GraphFiltersPanel
        nodeTypes={nodeTypes}
        edgeTypes={[]}
        filters={EMPTY_GRAPH_FILTERS}
        onChange={vi.fn() as (f: GraphFilters) => void}
      />,
    );
    expect(screen.getByText('No relations yet')).toBeDefined();
  });
});
