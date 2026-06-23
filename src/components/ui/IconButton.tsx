import React from 'react';
import { Button } from './Button';
import type { ButtonProps } from './Button';

interface IconButtonProps extends Omit<ButtonProps, 'size'> {
  'aria-label': string;
}

const iconButtonStyle: React.CSSProperties = {
  minWidth: '44px',
  minHeight: '44px',
  padding: 'var(--space-2)',
};

/**
 * Square icon-only button.
 *
 * Thin wrapper around {@link Button} that enforces a 44×44 minimum
 * hit target and requires an `aria-label` for screen-reader users.
 * Use anywhere the button's affordance is conveyed only by an
 * icon (close, edit, delete, etc.).
 */
export const IconButton: React.FC<IconButtonProps> = ({ style, ...rest }) => (
  <Button size="sm" style={{ ...iconButtonStyle, ...style }} {...rest} />
);

export default IconButton;
