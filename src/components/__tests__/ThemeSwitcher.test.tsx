import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ThemeSwitcher from '../ThemeSwitcher';

describe('ThemeSwitcher', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('renders all theme options', () => {
    render(<ThemeSwitcher />);
    expect(screen.getByText('Light')).toBeInTheDocument();
    expect(screen.getByText('Dark')).toBeInTheDocument();
  });

  it('defaults to light theme', () => {
    render(<ThemeSwitcher />);
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  });

  it('sets aria-pressed on active theme', () => {
    render(<ThemeSwitcher />);
    const lightBtn = screen.getByText('Light').closest('button');
    expect(lightBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('switches theme on click', () => {
    render(<ThemeSwitcher />);
    fireEvent.click(screen.getByText('Dark'));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });

  it('persists theme to localStorage', () => {
    render(<ThemeSwitcher />);
    fireEvent.click(screen.getByText('Dark'));
    expect(localStorage.getItem('do-knowledge-studio-theme')).toBe('dark');
  });

  it('restores theme from localStorage', () => {
    localStorage.setItem('do-knowledge-studio-theme', 'dark');
    render(<ThemeSwitcher />);
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });

  describe('compact mode', () => {
    it('renders compact toggle button', () => {
      render(<ThemeSwitcher compact />);
      expect(screen.getByLabelText('Switch theme')).toBeInTheDocument();
    });

    it('opens dropdown on click', () => {
      render(<ThemeSwitcher compact />);
      fireEvent.click(screen.getByLabelText('Switch theme'));
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('switches theme from dropdown', () => {
      render(<ThemeSwitcher compact />);
      fireEvent.click(screen.getByLabelText('Switch theme'));
      fireEvent.click(screen.getByText('Dark'));
      expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    });

    it('closes dropdown on Escape', () => {
      render(<ThemeSwitcher compact />);
      fireEvent.click(screen.getByLabelText('Switch theme'));
      const listbox = screen.getByRole('listbox');
      fireEvent.keyDown(listbox, { key: 'Escape' });
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('navigates with ArrowDown', () => {
      render(<ThemeSwitcher compact />);
      fireEvent.click(screen.getByLabelText('Switch theme'));
      const listbox = screen.getByRole('listbox');
      fireEvent.keyDown(listbox, { key: 'ArrowDown' });
      fireEvent.keyDown(listbox, { key: 'Enter' });
      expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    });
  });

  describe('click outside closes dropdown', () => {
    it('closes on outside click', () => {
      render(
        <div>
          <ThemeSwitcher compact />
          <button>Outside</button>
        </div>
      );
      fireEvent.click(screen.getByLabelText('Switch theme'));
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Outside'));
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  describe('localStorage unavailable', () => {
    it('does not crash when localStorage throws', () => {
      const original = Storage.prototype.getItem;
      Storage.prototype.getItem = vi.fn(() => { throw new Error('quota exceeded'); });
      render(<ThemeSwitcher />);
      expect(screen.getByText('Light')).toBeInTheDocument();
      Storage.prototype.getItem = original;
    });
  });
});
