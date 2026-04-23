import React, { useState, useEffect } from 'react';
import { jobCoordinator, JobMetrics as IJobMetrics } from '../lib/jobs';

const JobMetrics: React.FC = () => {
  const [metrics, setMetrics] = useState<IJobMetrics>(jobCoordinator.getMetrics());

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(jobCoordinator.getMetrics());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="job-metrics-panel" style={{
      position: 'fixed',
      bottom: '10px',
      right: '10px',
      background: 'rgba(0, 0, 0, 0.8)',
      color: '#fff',
      padding: '10px',
      borderRadius: '5px',
      fontSize: '12px',
      zIndex: 9999,
      pointerEvents: 'none',
      fontFamily: 'monospace'
    }}>
      <h4 style={{ margin: '0 0 5px 0', borderBottom: '1px solid #444' }}>Job Queue Metrics</h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
        <span>Queued:</span> <span>{metrics.queued}</span>
        <span>Running:</span> <span>{metrics.running}</span>
        <span>Completed:</span> <span>{metrics.completed}</span>
        <span>Failed:</span> <span>{metrics.failed}</span>
        <span>Cancelled:</span> <span>{metrics.cancelled}</span>
        <span>Coalesced:</span> <span>{metrics.coalesced}</span>
        <span>Avg Wait:</span> <span>{metrics.avgWaitTime.toFixed(0)}ms</span>
        <span>Avg Exec:</span> <span>{metrics.avgExecutionTime.toFixed(0)}ms</span>
      </div>
    </div>
  );
};

export default JobMetrics;
