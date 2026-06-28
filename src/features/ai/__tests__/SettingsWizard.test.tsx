import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../../components/Overlay', () => ({
  default: ({ children, isOpen, onClose: _onClose, ariaLabel }: { children: React.ReactNode; isOpen: boolean; onClose: () => void; ariaLabel?: string }) =>
    isOpen ? <div role="dialog" aria-label={ariaLabel}>{children}</div> : null,
}));

import { SettingsWizard } from '../SettingsWizard';

const mockConfig = {
  activeProvider: 'openrouter',
  providers: {
    openrouter: { baseURL: 'https://openrouter.ai/api/v1', apiKey: '', defaultModel: 'google/gemini-2.0-flash-lite-preview-02-05:free' },
    kilo: { baseURL: 'https://api.kilo.ai/api/gateway', apiKey: '', defaultModel: 'meta-llama/llama-3.1-8b-instruct' },
  },
};

describe('SettingsWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders welcome screen on step 0', () => {
    render(<SettingsWizard config={mockConfig} onComplete={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByText('Welcome to AI Harness')).toBeDefined();
  });

  it('calls onSkip when skip clicked', () => {
    const onSkip = vi.fn();
    render(<SettingsWizard config={mockConfig} onComplete={vi.fn()} onSkip={onSkip} />);
    fireEvent.click(screen.getByText('Skip setup'));
    expect(onSkip).toHaveBeenCalled();
  });

  it('navigates to step 1 on Get Started', () => {
    render(<SettingsWizard config={mockConfig} onComplete={vi.fn()} onSkip={vi.fn()} />);
    fireEvent.click(screen.getByText(/Get Started/));
    expect(screen.getByText(/Choose Provider/)).toBeDefined();
  });

  it('navigates to step 2', () => {
    render(<SettingsWizard config={mockConfig} onComplete={vi.fn()} onSkip={vi.fn()} />);
    fireEvent.click(screen.getByText(/Get Started/));
    fireEvent.click(screen.getByText(/Next/));
    expect(screen.getByText('Enter API Key')).toBeDefined();
  });

  it('completes with API key', () => {
    const onComplete = vi.fn();
    render(<SettingsWizard config={mockConfig} onComplete={onComplete} onSkip={vi.fn()} />);
    fireEvent.click(screen.getByText(/Get Started/));
    fireEvent.click(screen.getByText(/Next/));
    fireEvent.change(screen.getByPlaceholderText(/openrouter API key/), { target: { value: 'test-key' } });
    fireEvent.click(screen.getByText(/Complete Setup/));
    expect(onComplete).toHaveBeenCalled();
  });
});
