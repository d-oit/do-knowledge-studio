import React from 'react';

const LoadingSpinner: React.FC = () => (
  <div className="loading-screen" aria-live="polite">
    <div className="spinner" />
    <span>Loading...</span>
  </div>
);

export default LoadingSpinner;
