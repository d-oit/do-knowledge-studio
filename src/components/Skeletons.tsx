import React from 'react';

export const EditorSkeleton: React.FC = () => (
  <div className="skeleton-layout">
    <div className="skeleton-rect skeleton-animate" style={{ width: '40%', height: '32px' }} />
    <div className="skeleton-rect skeleton-animate" style={{ width: '100%', height: '150px', marginTop: '16px' }} />
    <div className="skeleton-rect skeleton-animate" style={{ width: '90%', height: '24px', marginTop: '12px' }} />
    <div className="skeleton-rect skeleton-animate" style={{ width: '95%', height: '24px', marginTop: '8px' }} />
    <div className="skeleton-rect skeleton-animate" style={{ width: '85%', height: '24px', marginTop: '8px' }} />
  </div>
);

export const GraphSkeleton: React.FC = () => (
  <div className="skeleton-layout" style={{ position: 'relative', overflow: 'hidden' }}>
    <div className="skeleton-circle skeleton-animate" style={{ position: 'absolute', width: '300px', height: '300px', top: '20%', left: '30%', opacity: 0.5 }} />
    <div className="skeleton-circle skeleton-animate" style={{ position: 'absolute', width: '150px', height: '150px', top: '50%', left: '10%', opacity: 0.3 }} />
    <div className="skeleton-circle skeleton-animate" style={{ position: 'absolute', width: '200px', height: '200px', top: '10%', left: '60%', opacity: 0.4 }} />
    <div className="skeleton-rect skeleton-animate" style={{ position: 'absolute', bottom: '24px', right: '24px', width: '120px', height: '44px' }} />
  </div>
);

export const MindMapSkeleton: React.FC = () => (
  <div className="skeleton-layout" style={{ alignItems: 'center', justifyContent: 'center' }}>
    <div className="skeleton-rect skeleton-animate" style={{ width: '150px', height: '60px', borderRadius: '12px' }} />
    <div style={{ display: 'flex', gap: '40px', marginTop: '40px' }}>
      <div className="skeleton-rect skeleton-animate" style={{ width: '100px', height: '40px' }} />
      <div className="skeleton-rect skeleton-animate" style={{ width: '100px', height: '40px' }} />
      <div className="skeleton-rect skeleton-animate" style={{ width: '100px', height: '40px' }} />
    </div>
  </div>
);

export const AISkeleton: React.FC = () => (
  <div className="skeleton-layout">
    <div className="skeleton-rect skeleton-animate" style={{ width: '30%', height: '24px' }} />
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px', flex: 1 }}>
      <div className="skeleton-rect skeleton-animate" style={{ height: '100%' }} />
      <div className="skeleton-rect skeleton-animate" style={{ height: '100%' }} />
    </div>
    <div className="skeleton-rect skeleton-animate" style={{ width: '100%', height: '60px', marginTop: '16px' }} />
  </div>
);

export const SearchSkeleton: React.FC = () => (
  <div className="skeleton-layout" style={{ padding: '16px' }}>
    <div className="skeleton-rect skeleton-animate" style={{ width: '100%', height: '44px' }} />
    <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
      <div className="skeleton-rect skeleton-animate" style={{ width: '60px', height: '24px', borderRadius: '12px' }} />
      <div className="skeleton-rect skeleton-animate" style={{ width: '80px', height: '24px', borderRadius: '12px' }} />
      <div className="skeleton-rect skeleton-animate" style={{ width: '60px', height: '24px', borderRadius: '12px' }} />
    </div>
    {[1, 2, 3, 4, 5].map(i => (
      <div key={i} style={{ marginTop: '24px' }}>
        <div className="skeleton-rect skeleton-animate" style={{ width: '40%', height: '16px' }} />
        <div className="skeleton-rect skeleton-animate" style={{ width: '100%', height: '12px', marginTop: '8px' }} />
        <div className="skeleton-rect skeleton-animate" style={{ width: '80%', height: '12px', marginTop: '4px' }} />
      </div>
    ))}
  </div>
);

export const ExportSkeleton: React.FC = () => (
  <div className="skeleton-layout">
    <div className="skeleton-rect skeleton-animate" style={{ width: '30%', height: '24px' }} />
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '16px', marginTop: '24px' }}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="skeleton-rect skeleton-animate" style={{ height: '120px' }} />
      ))}
    </div>
    <div className="skeleton-rect skeleton-animate" style={{ width: '100%', height: '44px', marginTop: '32px' }} />
  </div>
);
