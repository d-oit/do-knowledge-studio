import React from 'react';
import { Layout, LayoutDashboard, CircleDot } from 'lucide-react';

interface GraphLayoutControlsProps {
  layout: 'circular' | 'force' | 'hierarchical';
  onLayoutChange: (layout: 'circular' | 'force' | 'hierarchical') => void;
}

const GraphLayoutControls: React.FC<GraphLayoutControlsProps> = ({
  layout,
  onLayoutChange,
}) => {
  return (
    <div className="layout-toggle" style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
      <button
        onClick={() => onLayoutChange('circular')}
        className={layout === 'circular' ? 'active' : ''}
        aria-pressed={layout === 'circular'}
        aria-label="Circular layout"
        title="Circular layout"
        style={{ padding: '6px 10px', minHeight: '36px', fontSize: '12px' }}
      >
        <CircleDot size={14} /> Circular
      </button>
      <button
        onClick={() => onLayoutChange('force')}
        className={layout === 'force' ? 'active' : ''}
        aria-pressed={layout === 'force'}
        aria-label="Force-directed layout"
        title="Force-directed layout"
        style={{ padding: '6px 10px', minHeight: '36px', fontSize: '12px' }}
      >
        <LayoutDashboard size={14} /> Force
      </button>
      <button
        onClick={() => onLayoutChange('hierarchical')}
        className={layout === 'hierarchical' ? 'active' : ''}
        aria-pressed={layout === 'hierarchical'}
        aria-label="Hierarchical layout"
        title="Hierarchical layout"
        style={{ padding: '6px 10px', minHeight: '36px', fontSize: '12px' }}
      >
        <Layout size={14} /> Hierarchical
      </button>
    </div>
  );
};

export default GraphLayoutControls;
