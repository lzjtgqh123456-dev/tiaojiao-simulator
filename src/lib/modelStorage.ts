const DB_NAME = 'UltraModelDB';
const STORE_NAME = 'customModels';

export interface StoredModel {
  name: string;
  ext: string;
  data: ArrayBuffer;
  updatedAt: number;
}

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

export async function saveModelToIDB(heroId: string, file: File): Promise<StoredModel | null> {
  try {
    const db = await openDB();
    const buffer = await file.arrayBuffer();
    const ext = file.name.split('.').pop()?.toLowerCase() || 'glb';

    const record: StoredModel = {
      name: file.name,
      ext,
      data: buffer,
      updatedAt: Date.now(),
    };

    if (!db || !db.objectStoreNames.contains(STORE_NAME)) return record;
    const key = `model_${heroId || 'default'}`;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(record, key);
        req.onsuccess = () => resolve(record);
        req.onerror = () => resolve(record);
        tx.onabort = () => resolve(record);
        tx.onerror = () => resolve(record);
      } catch {
        resolve(record);
      }
    });
  } catch (err) {
    console.warn(`Failed to save model for ${heroId} to IDB:`, err);
    return null;
  }
}

export async function getModelFromIDB(heroId: string): Promise<StoredModel | null> {
  try {
    const db = await openDB();
    if (!db || !db.objectStoreNames.contains(STORE_NAME)) return null;
    const key = `model_${heroId || 'default'}`;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
        tx.onabort = () => resolve(null);
        tx.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  } catch (err) {
    console.warn(`Failed to load model for ${heroId} from IDB:`, err);
    return null;
  }
}

export async function clearModelFromIDB(heroId: string): Promise<void> {
  try {
    const db = await openDB();
    if (!db || !db.objectStoreNames.contains(STORE_NAME)) return;
    const key = `model_${heroId || 'default'}`;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        tx.onabort = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch (err) {
    console.warn(`Failed to clear model for ${heroId} from IDB:`, err);
  }
}

