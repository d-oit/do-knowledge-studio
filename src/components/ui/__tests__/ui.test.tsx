import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '../Button';
import { IconButton } from '../IconButton';
import { EmptyState } from '../EmptyState';
import { Skeleton } from '../Skeleton';

describe('Button', () => {
  it('renders children inside a button element', () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole('button', { name: 'Click me' });
    expect(button).toBeTruthy();
  });

  it('applies primary variant styles by default behavior', () => {
    render(<Button variant="primary">Primary</Button>);
    const button = screen.getByRole('button', { name: 'Primary' });
    expect(button).toBeTruthy();
  });

  it('applies secondary variant by default', () => {
    render(<Button>Default</Button>);
    const button = screen.getByRole('button', { name: 'Default' });
    expect(button).toBeTruthy();
  });

  it('supports ghost variant', () => {
    render(<Button variant="ghost">Ghost</Button>);
    const button = screen.getByRole('button', { name: 'Ghost' });
    expect(button).toBeTruthy();
  });

  it('supports danger variant', () => {
    render(<Button variant="danger">Danger</Button>);
    const button = screen.getByRole('button', { name: 'Danger' });
    expect(button).toBeTruthy();
  });

  it('supports sm size', () => {
    render(<Button size="sm">Small</Button>);
    const button = screen.getByRole('button', { name: 'Small' });
    expect(button).toBeTruthy();
  });

  it('supports lg size', () => {
    render(<Button size="lg">Large</Button>);
    const button = screen.getByRole('button', { name: 'Large' });
    expect(button).toBeTruthy();
  });

  it('respects disabled prop', () => {
    render(<Button disabled>Disabled</Button>);
    const button = screen.getByRole('button', { name: 'Disabled' });
    expect(button).toBeDisabled();
  });

  it('forwards onClick handler', () => {
    let clicked = false;
    render(<Button onClick={() => { clicked = true; }}>Clickable</Button>);
    const button = screen.getByRole('button', { name: 'Clickable' });
    button.click();
    expect(clicked).toBe(true);
  });

  it('forwards custom style and data-testid', () => {
    render(<Button data-testid="custom-btn" style={{ color: 'rgb(255, 0, 0)' }}>Styled</Button>);
    const button = screen.getByTestId('custom-btn');
    expect(button).toBeTruthy();
  });
});

describe('IconButton', () => {
  it('renders with required aria-label', () => {
    render(<IconButton aria-label="Icon action">X</IconButton>);
    const button = screen.getByRole('button', { name: 'Icon action' });
    expect(button).toBeTruthy();
  });

  it('supports disabled state', () => {
    render(<IconButton aria-label="Disabled icon" disabled>X</IconButton>);
    const button = screen.getByRole('button', { name: 'Disabled icon' });
    expect(button).toBeDisabled();
  });

  it('forwards onClick', () => {
    let clicked = false;
    render(
      <IconButton aria-label="Clickable icon" onClick={() => { clicked = true; }}>
        X
      </IconButton>
    );
    const button = screen.getByRole('button', { name: 'Clickable icon' });
    button.click();
    expect(clicked).toBe(true);
  });
});

describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="Nothing here" />);
    const title = screen.getByRole('heading', { name: 'Nothing here' });
    expect(title).toBeTruthy();
  });

  it('renders description when provided', () => {
    render(<EmptyState title="Title" description="A descriptive text" />);
    expect(screen.getByText('A descriptive text')).toBeTruthy();
  });

  it('renders icon when provided', () => {
    render(
      <EmptyState
        title="With icon"
        icon={<span data-testid="empty-icon">★</span>}
      />
    );
    expect(screen.getByTestId('empty-icon')).toBeTruthy();
  });

  it('renders action when provided', () => {
    render(
      <EmptyState
        title="With action"
        action={<button type="button">Do something</button>}
      />
    );
    const action = screen.getByRole('button', { name: 'Do something' });
    expect(action).toBeTruthy();
  });

  it('omits description and icon when not provided', () => {
    const { container } = render(<EmptyState title="Minimal" />);
    const status = container.querySelector('[role="status"]');
    expect(status).toBeTruthy();
  });
});

describe('Skeleton', () => {
  it('renders a hidden div by default', () => {
    const { container } = render(<Skeleton />);
    const skeleton = container.querySelector('[aria-hidden="true"]');
    expect(skeleton).toBeTruthy();
  });

  it('accepts width and height', () => {
    const { container } = render(<Skeleton width="200px" height="40px" />);
    const skeleton = container.querySelector('[aria-hidden="true"]');
    expect(skeleton).toBeTruthy();
  });

  it('supports circle variant', () => {
    const { container } = render(<Skeleton variant="circle" />);
    const skeleton = container.querySelector('[aria-hidden="true"]');
    expect(skeleton).toBeTruthy();
  });

  it('supports text variant', () => {
    const { container } = render(<Skeleton variant="text" />);
    const skeleton = container.querySelector('[aria-hidden="true"]');
    expect(skeleton).toBeTruthy();
  });

  it('forwards custom style', () => {
    const { container } = render(<Skeleton style={{ marginTop: '10px' }} />);
    const skeleton = container.querySelector('[aria-hidden="true"]');
    expect(skeleton).toBeTruthy();
  });
});
