import { logger } from './logger';

const DB_NAME = 'do-knowledge-studio-meta';
const STORE_NAME = 'file-handles';
const HANDLE_KEY = 'shared-db-handle';
const DIR_HANDLE_KEY = 'shared-db-dir-handle';

/**
 * Persist and retrieve FileSystemFileHandle and FileSystemDirectoryHandle using IndexedDB.
 */

export const saveDbHandles = async (fileHandle: FileSystemFileHandle, dirHandle: FileSystemDirectoryHandle): Promise<void> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      store.put(fileHandle, HANDLE_KEY);
      const putRequest = store.put(dirHandle, DIR_HANDLE_KEY);

      putRequest.onsuccess = () => {
        logger.info('Database handles saved to IndexedDB');
        resolve();
      };

      putRequest.onerror = () => {
        logger.error('Failed to save database handles', putRequest.error);
        reject(new Error('Failed to save database handles'));
      };
    };

    request.onerror = () => {
      logger.error('Failed to open IndexedDB for saving handles', request.error);
      reject(new Error('Failed to open IndexedDB for saving handles'));
    };
  });
};

export const getDbHandles = async (): Promise<{ fileHandle: FileSystemFileHandle | null, dirHandle: FileSystemDirectoryHandle | null }> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);

      const fileRequest = store.get(HANDLE_KEY);
      const dirRequest = store.get(DIR_HANDLE_KEY);

      let fileHandle: FileSystemFileHandle | null = null;
      let dirHandle: FileSystemDirectoryHandle | null = null;

      fileRequest.onsuccess = () => {
        fileHandle = (fileRequest.result as FileSystemFileHandle) || null;
      };

      dirRequest.onsuccess = () => {
        dirHandle = (dirRequest.result as FileSystemDirectoryHandle) || null;
        resolve({ fileHandle, dirHandle });
      };

      transaction.onerror = () => {
        logger.error('Failed to retrieve database handles', transaction.error);
        reject(new Error('Failed to retrieve database handles'));
      };
    };

    request.onerror = () => {
      logger.error('Failed to open IndexedDB for retrieving handles', request.error);
      reject(new Error('Failed to open IndexedDB for retrieving handles'));
    };
  });
};

export const clearDbHandles = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      store.delete(HANDLE_KEY);
      const deleteRequest = store.delete(DIR_HANDLE_KEY);

      deleteRequest.onsuccess = () => {
        logger.info('Database handles cleared from IndexedDB');
        resolve();
      };

      deleteRequest.onerror = () => {
        logger.error('Failed to clear database handles', deleteRequest.error);
        reject(new Error('Failed to clear database handles'));
      };
    };

    request.onerror = () => {
      logger.error('Failed to open IndexedDB for clearing handles', request.error);
      reject(new Error('Failed to open IndexedDB for clearing handles'));
    };
  });
};
