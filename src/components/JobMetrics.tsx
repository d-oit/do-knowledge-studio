import React, { useEffect, useState, useRef } from 'react';
import { jobCoordinator, JobMetrics as Metrics } from '../lib/jobs';

const JobMetrics: React.FC = () => {
  const [metrics, setMetrics] = useState<Metrics>(jobCoordinator.getMetrics());
  const renderCount = useRef(0);
  renderCount.current++;

  useEffect(() => {
    return jobCoordinator.subscribe(setMetrics);
  }, []);

  if (process.env.NODE_ENV === 'production' && !import.meta.env?.DEV) return null;

  return (
    <div className="job-metrics-panel" style={{
      position: 'fixed',
      bottom: '1rem',
      right: '1rem',
      background: 'rgba(0,0,0,0.8)',
      color: '#fff',
      padding: '0.75rem',
      borderRadius: '8px',
      fontSize: '0.75rem',
      zIndex: 9999,
      fontFamily: 'monospace',
      pointerEvents: 'none'
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', borderBottom: '1px solid #444' }}>
        Background Jobs
      </div>
      <div>Queued: {metrics.queued}</div>
      <div>Running: {metrics.running}</div>
      <div>Completed: {metrics.completed}</div>
      <div>Failed: {metrics.failed}</div>
      <div>Cancelled: {metrics.cancelled}</div>
      <div>Coalesced: {metrics.coalesced}</div>
      <div>Avg Execution: {metrics.completed > 0 ? (metrics.totalExecutionTime / metrics.completed).toFixed(2) : 0}ms</div>
      <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #444' }}>
        UI Renders: {renderCount.current}
      </div>
    </div>
  );
};

export default JobMetrics;
