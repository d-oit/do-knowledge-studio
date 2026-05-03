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

  // Only show in development
  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <div className="job-metrics-panel">
      <h4>Job Queue Metrics</h4>
      <div className="metrics-grid">
        <span className="metric-label">Queued:</span>
        <span className="metric-value">{metrics.queued}</span>

        <span className="metric-label">Running:</span>
        <span className="metric-value">{metrics.running}</span>

        <span className="metric-label">Completed:</span>
        <span className="metric-value">{metrics.completed}</span>

        <span className="metric-label">Failed:</span>
        <span className="metric-value">{metrics.failed}</span>

        <span className="metric-label">Cancelled:</span>
        <span className="metric-value">{metrics.cancelled}</span>

        <span className="metric-label">Coalesced:</span>
        <span className="metric-value">{metrics.coalesced}</span>

        <span className="metric-label">Avg Wait:</span>
        <span className="metric-value">{metrics.avgWaitTime.toFixed(0)}ms</span>

        <span className="metric-label">Avg Exec:</span>
        <span className="metric-value">{metrics.avgExecutionTime.toFixed(0)}ms</span>
      </div>
    </div>
  );
};

export default JobMetrics;
