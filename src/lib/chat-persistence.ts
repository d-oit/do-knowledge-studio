const DB_NAME = 'dks-chat-history';
const DB_VERSION = 1;
const STORE_NAME = 'messages';

interface ChatMessage {
  id: string;
  role: 'assistant' | 'user' | 'system';
  content: string;
  tokenUsage?: { input: number; output: number };
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(new Error(String(request.error)));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

export async function loadChatHistory(): Promise<ChatMessage[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        const messages = request.result as ChatMessage[];
        resolve(messages.sort((a, b) => {
          const aTime = getTimestampFromId(a.id);
          const bTime = getTimestampFromId(b.id);
          return aTime - bTime;
        }));
      };
      request.onerror = () => reject(new Error(String(request.error)));
    });
  } catch {
    return [];
  }
}

export async function saveChatHistory(messages: ChatMessage[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const msg of messages) {
      store.put(msg);
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error(String(tx.error)));
    });
  } catch {
    // Silently fail — chat history persistence is best-effort
  }
}

export async function clearChatHistory(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error(String(tx.error)));
    });
  } catch {
    // Silently fail
  }
}

function getTimestampFromId(id: string): number {
  const ts = id.split('-')[0];
  const num = parseInt(ts, 10);
  return isNaN(num) ? 0 : num;
}
