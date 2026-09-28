const DB_NAME = 'UltraPortraitDB';
const STORE_NAME = 'customPortraits';

function openDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      return resolve(null);
    }
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function savePortraitToIDB(heroId: string, portrait: string): Promise<void> {
  if (!heroId || !portrait || typeof indexedDB === 'undefined') return;
  try {
    const db = await openDB();
    if (!db || !db.objectStoreNames.contains(STORE_NAME)) return;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(portrait, heroId);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        tx.onabort = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch (err) {
    console.warn(`Failed to save portrait for ${heroId} to IDB:`, err);
  }
}

export async function getPortraitFromIDB(heroId: string): Promise<string | null> {
  if (!heroId || typeof indexedDB === 'undefined') return null;
  try {
    const db = await openDB();
    if (!db || !db.objectStoreNames.contains(STORE_NAME)) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(heroId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
        tx.onabort = () => resolve(null);
        tx.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  } catch (err) {
    console.warn(`Failed to load portrait for ${heroId} from IDB:`, err);
    return null;
  }
}

export async function getAllPortraitsFromIDB(timeoutMs: number = 1500): Promise<Record<string, string>> {
  if (typeof indexedDB === 'undefined') return {};
  try {
    const fetchPromise = (async () => {
      const db = await openDB();
      if (!db || !db.objectStoreNames.contains(STORE_NAME)) return {};
      return new Promise<Record<string, string>>((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const request = store.openCursor();
          const portraits: Record<string, string> = {};

          request.onsuccess = (e) => {
            const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
              if (typeof cursor.key === 'string' && typeof cursor.value === 'string') {
                portraits[cursor.key] = cursor.value;
              }
              cursor.continue();
            } else {
              resolve(portraits);
            }
          };
          request.onerror = () => resolve(portraits);
          tx.onabort = () => resolve(portraits);
          tx.onerror = () => resolve(portraits);
        } catch {
          resolve({});
        }
      });
    })();

    const timeoutPromise = new Promise<Record<string, string>>((resolve) =>
      setTimeout(() => resolve({}), timeoutMs)
    );

    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (err) {
    console.warn('Failed to load all portraits from IDB:', err);
    return {};
  }
}

export async function clearPortraitFromIDB(heroId: string): Promise<void> {
  if (!heroId || typeof indexedDB === 'undefined') return;
  try {
    const db = await openDB();
    if (!db || !db.objectStoreNames.contains(STORE_NAME)) return;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(heroId);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        tx.onabort = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch (err) {
    console.warn(`Failed to clear portrait for ${heroId} from IDB:`, err);
  }
}

/**
 * Clear all portraits stored in IndexedDB
 */
export async function clearAllPortraitsFromIDB(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.close();
      return;
    }
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.clear();
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          resolve();
        };
        tx.onabort = () => {
          db.close();
          resolve();
        };
      } catch {
        db.close();
        resolve();
      }
    });
  } catch (err) {
    console.warn('Failed to clear all portraits from IDB:', err);
  }
}
