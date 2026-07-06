import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SidebarNav from '../SidebarNav';

describe('SidebarNav', () => {
  const defaultProps = {
    currentView: 'editor' as const,
    setCurrentView: vi.fn(),
  };

  it('renders all navigation groups', () => {
    render(<SidebarNav {...defaultProps} />);
    expect(screen.getByText('Knowledge Studio')).toBeInTheDocument();
    expect(screen.getByText('Capture')).toBeInTheDocument();
    expect(screen.getByText('Explore')).toBeInTheDocument();
    expect(screen.getByText('Ask')).toBeInTheDocument();
    expect(screen.getByText('Move')).toBeInTheDocument();
    expect(screen.getByText('Lab')).toBeInTheDocument();
  });

  it('renders all nav items', () => {
    render(<SidebarNav {...defaultProps} />);
    expect(screen.getByText('Editor')).toBeInTheDocument();
    expect(screen.getByText('Library')).toBeInTheDocument();
    expect(screen.getByText('Graph')).toBeInTheDocument();
    expect(screen.getByText('Mind Map')).toBeInTheDocument();
    expect(screen.getByText('Search')).toBeInTheDocument();
    expect(screen.getByText('Chat')).toBeInTheDocument();
    expect(screen.getByText('Export')).toBeInTheDocument();
    expect(screen.getByText('AI Harness')).toBeInTheDocument();
    expect(screen.getByText('TRIZ Matrix')).toBeInTheDocument();
  });

  it('marks current view with aria-current', () => {
    render(<SidebarNav {...defaultProps} currentView="graph" />);
    const graphBtn = screen.getByText('Graph').closest('button');
    expect(graphBtn).toHaveAttribute('aria-current', 'page');
  });

  it('calls setCurrentView when nav item is clicked', () => {
    const setCurrentView = vi.fn();
    render(<SidebarNav {...defaultProps} setCurrentView={setCurrentView} />);
    fireEvent.click(screen.getByText('Library'));
    expect(setCurrentView).toHaveBeenCalledWith('library');
  });

  it('calls onClose after nav item click', () => {
    const onClose = vi.fn();
    render(<SidebarNav {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByText('Editor'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onSearchClick for search view instead of setCurrentView', () => {
    const setCurrentView = vi.fn();
    const onSearchClick = vi.fn();
    render(<SidebarNav {...defaultProps} setCurrentView={setCurrentView} onSearchClick={onSearchClick} />);
    fireEvent.click(screen.getByText('Search'));
    expect(onSearchClick).toHaveBeenCalled();
    expect(setCurrentView).not.toHaveBeenCalled();
  });

  it('shows experimental badge for Lab items', () => {
    render(<SidebarNav {...defaultProps} />);
    const badges = screen.getAllByText('Experimental');
    expect(badges.length).toBe(2);
  });

  it('calls onPreload on mouse enter', () => {
    const onPreload = vi.fn();
    render(<SidebarNav {...defaultProps} onPreload={onPreload} />);
    fireEvent.mouseEnter(screen.getByText('Graph'));
    expect(onPreload).toHaveBeenCalledWith('graph');
  });

  it('calls onPreload on focus', () => {
    const onPreload = vi.fn();
    render(<SidebarNav {...defaultProps} onPreload={onPreload} />);
    fireEvent.focus(screen.getByText('Chat'));
    expect(onPreload).toHaveBeenCalledWith('chat');
  });
});
