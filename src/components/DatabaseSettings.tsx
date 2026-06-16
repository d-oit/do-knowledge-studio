import React, { useState } from 'react';
import { Database, HardDrive, RefreshCcw, AlertCircle, CheckCircle2, FileWarning } from 'lucide-react';
import { logger } from '../lib/logger';

interface DatabaseSettingsProps {
  onHandlesSelected: (fileHandle: FileSystemFileHandle, dirHandle: FileSystemDirectoryHandle) => void;
  currentHandle?: FileSystemFileHandle | null;
}

const DatabaseSettings: React.FC<DatabaseSettingsProps> = ({ onHandlesSelected, currentHandle }) => {
  const [isSupported] = useState(() => 'showOpenFilePicker' in window);

  const handleConnect = async () => {
    try {
      // Use directory picker to allow creating lock files
      const dirHandle = await window.showDirectoryPicker({
        mode: 'readwrite',
      });

      const dbHandle = await dirHandle.getFileHandle('data.db', { create: true });

      // Request readwrite permission (directory handle covers its children)
      const permission = await dirHandle.queryPermission({ mode: 'readwrite' });
      if (permission !== 'granted') {
        const request = await dirHandle.requestPermission({ mode: 'readwrite' });
        if (request !== 'granted') {
          throw new Error('Read/Write permission denied');
        }
      }

      // Store the handles so we can create lock files later
      onHandlesSelected(dbHandle, dirHandle);
      // For now, let's just store the dbHandle and see if we can get parent later,
      // or better, update the signature.

      logger.info('Local database directory selected', { name: dirHandle.name });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        logger.error('Failed to select database directory', err);
        alert(`Failed to connect to local database: ${(err as Error).message}`);
      }
    }
  };

  if (!isSupported) {
    return (
      <div className="database-settings-card error">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b91c1c' }}>
          <FileWarning size={20} />
          <h3 style={{ margin: 0 }}>Not Supported</h3>
        </div>
        <p style={{ fontSize: '0.875rem', marginTop: '8px' }}>
          The File System Access API is not supported in this browser. Please use a modern browser like Chrome or Edge to enable local database synchronization.
        </p>
      </div>
    );
  }

  return (
    <div className="database-settings-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <Database size={20} />
        <h3 style={{ margin: 0 }}>Local Database Sync</h3>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem' }}>
          {currentHandle ? (
            <>
              <CheckCircle2 size={16} color="#059669" />
              <span>Connected to: <strong>{currentHandle.name}</strong></span>
            </>
          ) : (
            <>
              <AlertCircle size={16} color="#d97706" />
              <span>Using browser-only storage (OPFS)</span>
            </>
          )}
        </div>

        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0' }}>
          Synchronize your knowledge base with a local file to share data with the CLI.
          The default CLI path is: <code>~/.local/share/do-knowledge-studio/data.db</code>
        </p>

        <button
          type="button"
          className="primary"
          onClick={() => void handleConnect()}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '8px 16px' }}
        >
          <HardDrive size={18} />
          {currentHandle ? 'Change Database File' : 'Connect Local Database'}
        </button>

        {currentHandle && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <RefreshCcw size={12} className="animate-spin" />
            Auto-syncing changes to local file
          </div>
        )}
      </div>
    </div>
  );
};

export default DatabaseSettings;
