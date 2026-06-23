import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 'var(--space-12) var(--space-6)',
  textAlign: 'center',
  gap: 'var(--space-4)',
};

const iconStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  marginBottom: 'var(--space-2)',
};

const titleStyle: React.CSSProperties = {
  fontSize: 'var(--size-lg)',
  fontWeight: 'var(--weight-semibold)',
  color: 'var(--text-primary)',
  margin: 0,
};

const descStyle: React.CSSProperties = {
  fontSize: 'var(--size-body)',
  color: 'var(--text-secondary)',
  maxWidth: '320px',
  margin: 0,
};

/**
 * Centered empty-state placeholder.
 *
 * Used by feature views to communicate "no content yet" with a single
 * hero icon, a title, an optional description line, and an optional
 * `action` (usually a primary button). The container carries
 * `role="status"` so screen readers announce state changes.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action }) => (
  <div style={containerStyle} role="status">
    {icon && <div style={iconStyle} aria-hidden="true">{icon}</div>}
    <h3 style={titleStyle}>{title}</h3>
    {description && <p style={descStyle}>{description}</p>}
    {action && <div>{action}</div>}
  </div>
);

export default EmptyState;
