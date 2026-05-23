import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import { perf } from './lib/perf';

perf.mark('app-bootstrap-start');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

perf.measure('app-first-render', 'app-bootstrap-start');
