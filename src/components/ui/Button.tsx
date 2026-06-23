import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: 'var(--interactive-primary)',
    color: 'var(--text-inverse)',
    border: 'none',
  },
  secondary: {
    background: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-default)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-primary)',
    border: 'none',
  },
  danger: {
    background: 'var(--status-danger)',
    color: 'var(--text-inverse)',
    border: 'none',
  },
};

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: {
    padding: 'var(--space-1) var(--space-3)',
    fontSize: 'var(--size-sm)',
    minHeight: '32px',
  },
  md: {
    padding: 'var(--space-2) var(--space-4)',
    fontSize: 'var(--size-body)',
    minHeight: '40px',
  },
  lg: {
    padding: 'var(--space-3) var(--space-6)',
    fontSize: 'var(--size-lg)',
    minHeight: '48px',
  },
};

const baseStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'var(--space-2)',
  borderRadius: 'var(--radius-base)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontWeight: 'var(--weight-medium)',
  lineHeight: 1,
  transition: 'background var(--motion-fast), border-color var(--motion-fast), opacity var(--motion-fast)',
  whiteSpace: 'nowrap',
};

const disabledStyle: React.CSSProperties = {
  opacity: 0.5,
  cursor: 'not-allowed',
  background: 'var(--interactive-disabled)',
  color: 'var(--text-secondary)',
  border: 'none',
};

/**
 * Foundational button primitive.
 *
 * Renders a styled `<button>` that combines a `variant` (color/weight
 * intent) with a `size` (height/padding scale) and forwards every
 * other native button prop. All styling is derived from the design
 * tokens in `src/styles/index.css` so themes apply without code
 * changes.
 */
export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  disabled,
  style,
  ...rest
}) => (
  <button
    disabled={disabled}
    style={{ ...baseStyle, ...variantStyles[variant], ...sizeStyles[size], ...(disabled ? disabledStyle : {}), ...style }}
    {...rest}
  />
);

export default Button;
