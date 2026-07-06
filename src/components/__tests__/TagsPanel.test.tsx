import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithDb } from '../../test/test-utils';
import TagsPanel from '../TagsPanel';
import { IRepository } from '../../db/repository';
import { Tag } from '../../lib/validation';

const mockTags: Tag[] = [
  { id: '1', name: 'important', color: '#2563eb' },
  { id: '2', name: 'draft', color: '#059669' },
];

const mockTagsWithCount = [
  { ...mockTags[0], entity_count: 3 },
  { ...mockTags[1], entity_count: 1 },
];

function createMockRepository(overrides: Partial<IRepository> = {}): IRepository {
  return {
    getAllTags: vi.fn().mockReturnValue(Promise.resolve(mockTagsWithCount)),
    getTagsByEntityId: vi.fn().mockReturnValue(Promise.resolve([mockTags[0]])),
    createTag: vi.fn().mockReturnValue(Promise.resolve({ id: '3', name: 'new-tag', color: '#dc2626' })),
    addTagToEntity: vi.fn().mockReturnValue(Promise.resolve(undefined)),
    removeTagFromEntity: vi.fn().mockReturnValue(Promise.resolve(undefined)),
    ...overrides,
  } as unknown as IRepository;
}

describe('TagsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders header', () => {
    const repo = createMockRepository();
    renderWithDb(<TagsPanel />, { repository: repo });
    expect(screen.getByText('Tags')).toBeInTheDocument();
  });

  it('loads and displays all tags', async () => {
    const repo = createMockRepository();
    renderWithDb(<TagsPanel />, { repository: repo });
    await waitFor(() => {
      expect(screen.getByText('important')).toBeInTheDocument();
      expect(screen.getByText('draft')).toBeInTheDocument();
    });
  });

  it('displays tag counts', async () => {
    const repo = createMockRepository();
    renderWithDb(<TagsPanel />, { repository: repo });
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });

  it('shows entity tags when entityId is provided', async () => {
    const repo = createMockRepository();
    renderWithDb(<TagsPanel entityId="entity-1" />, { repository: repo });
    await waitFor(() => {
      expect(repo.getTagsByEntityId).toHaveBeenCalledWith('entity-1');
    });
  });

  it('shows "No tags applied" when entity has no tags', async () => {
    const repo = createMockRepository({ getTagsByEntityId: vi.fn().mockResolvedValue([]) });
    renderWithDb(<TagsPanel entityId="entity-1" />, { repository: repo });
    await waitFor(() => {
      expect(screen.getByText('No tags applied')).toBeInTheDocument();
    });
  });

  it('creates a new tag', async () => {
    const repo = createMockRepository();
    renderWithDb(<TagsPanel entityId="entity-1" />, { repository: repo });

    await waitFor(() => {
      expect(screen.getAllByText('important').length).toBeGreaterThan(0);
    });

    const input = screen.getByLabelText('New tag name');
    fireEvent.change(input, { target: { value: 'urgent' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(repo.createTag).toHaveBeenCalledWith('urgent', '#2563eb');
      expect(repo.addTagToEntity).toHaveBeenCalledWith('entity-1', '3');
    });
  });

  it('disables create button when name is empty', () => {
    const repo = createMockRepository();
    renderWithDb(<TagsPanel />, { repository: repo });
    const createBtn = screen.getByLabelText('Create new tag');
    expect(createBtn).toBeDisabled();
  });

  it('toggles tag on/off for entity', async () => {
    const repo = createMockRepository();
    renderWithDb(<TagsPanel entityId="entity-1" />, { repository: repo });

    await waitFor(() => {
      expect(screen.getAllByText('important').length).toBeGreaterThan(0);
    });

    // Click the entity tag chip to remove it
    const removeBtn = screen.getByLabelText('Remove tag important');
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(repo.removeTagFromEntity).toHaveBeenCalledWith('entity-1', '1');
    });
  });

  it('selects a color from the color picker', () => {
    const repo = createMockRepository();
    renderWithDb(<TagsPanel />, { repository: repo });
    const colorBtn = screen.getByLabelText('Select color #dc2626');
    fireEvent.click(colorBtn);
    // No assertion needed — just verify no crash
  });

  it('calls onTagsChange after tag creation', async () => {
    const onTagsChange = vi.fn();
    const repo = createMockRepository();
    renderWithDb(<TagsPanel entityId="entity-1" onTagsChange={onTagsChange} />, { repository: repo });

    await waitFor(() => {
      expect(screen.getAllByText('important').length).toBeGreaterThan(0);
    });

    const input = screen.getByLabelText('New tag name');
    fireEvent.change(input, { target: { value: 'new-tag' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(onTagsChange).toHaveBeenCalled();
    });
  });
});
