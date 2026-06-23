import React from 'react';

interface SkeletonProps {
  width?: string;
  height?: string;
  variant?: 'rect' | 'circle' | 'text';
  style?: React.CSSProperties;
}

const baseStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-base)',
  borderRadius: 'var(--radius-sm)',
};

const variantMap: Record<NonNullable<SkeletonProps['variant']>, React.CSSProperties> = {
  rect: { borderRadius: 'var(--radius-sm)' },
  circle: { borderRadius: 'var(--radius-full)' },
  text: { borderRadius: 'var(--radius-sm)', height: '1em' },
};

/**
 * Animated placeholder block used to reserve layout space while
 * content is loading.
 *
 * Marked `aria-hidden="true"` so screen readers ignore it. The
 * `variant` controls corner radius and the inherent height for text
 * lines; width/height defaults can be overridden inline.
 */
export const Skeleton: React.FC<SkeletonProps> = ({ width, height, variant = 'rect', style }) => (
  <div
    className="skeleton-animate"
    style={{
      ...baseStyle,
      ...variantMap[variant],
      width: width ?? '100%',
      height: height ?? '16px',
      ...style,
    }}
    aria-hidden="true"
  />
);

export default Skeleton;
