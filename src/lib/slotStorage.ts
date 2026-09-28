/**
 * Dedicated IndexedDB Storage for Game Save Slots & File System Directory Handles
 * 
 * Solves:
 * - 5MB localStorage QuotaExceededError which caused manual saves to disappear on refresh
 * - In-memory DirectoryHandle loss on page reload/refresh
 */
import { SaveSlotData } from '../components/SaveLoadManagerModal';

const SLOTS_DB_NAME = 'UltraSaveSlotsDB';
const SLOTS_STORE_NAME = 'saveSlots';
const HANDLES_STORE_NAME = 'fsHandles';
const ALL_SLOTS_KEY = 'ultra_all_save_slots_v2';
const DIR_HANDLE_KEY = 'backup_dir_handle';

function openSlotsDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      return resolve(null);
    }
    try {
      const request = indexedDB.open(SLOTS_DB_NAME, 2);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(SLOTS_STORE_NAME)) {
          db.createObjectStore(SLOTS_STORE_NAME);
        }
        if (!db.objectStoreNames.contains(HANDLES_STORE_NAME)) {
          db.createObjectStore(HANDLES_STORE_NAME);
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

/**
 * Save all save slots to IndexedDB safely without size limitations
 */
export async function saveSlotsToIDB(slots: SaveSlotData[]): Promise<void> {
  if (!Array.isArray(slots)) return;
  try {
    const db = await openSlotsDB();
    if (!db || !db.objectStoreNames.contains(SLOTS_STORE_NAME)) return;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(SLOTS_STORE_NAME, 'readwrite');
        const store = tx.objectStore(SLOTS_STORE_NAME);
        const req = store.put(slots, ALL_SLOTS_KEY);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        tx.onabort = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch (err) {
    console.warn('[SlotStorage] Failed to save slots to IndexedDB:', err);
  }
}

/**
 * Retrieve all save slots from IndexedDB
 */
export async function getSlotsFromIDB(): Promise<SaveSlotData[] | null> {
  try {
    const db = await openSlotsDB();
    if (!db || !db.objectStoreNames.contains(SLOTS_STORE_NAME)) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(SLOTS_STORE_NAME, 'readonly');
        const store = tx.objectStore(SLOTS_STORE_NAME);
        const req = store.get(ALL_SLOTS_KEY);
        req.onsuccess = () => {
          const result = req.result;
          if (Array.isArray(result)) {
            resolve(result);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
        tx.onabort = () => resolve(null);
        tx.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  } catch (err) {
    console.warn('[SlotStorage] Failed to get slots from IndexedDB:', err);
    return null;
  }
}

/**
 * Persist DirectoryHandle in IndexedDB across reloads
 */
export async function saveDirectoryHandleToIDB(handle: any): Promise<void> {
  if (!handle) return;
  try {
    const db = await openSlotsDB();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(HANDLES_STORE_NAME, 'readwrite');
        const store = tx.objectStore(HANDLES_STORE_NAME);
        const req = store.put(handle, DIR_HANDLE_KEY);
        req.onsuccess = () => resolve();
        req.onerror = (e) => {
          console.warn('[SlotStorage] req.onerror saving directory handle:', e);
          resolve();
        };
        tx.onabort = (e) => {
          console.warn('[SlotStorage] tx.onabort saving directory handle:', e);
          resolve();
        };
        tx.onerror = (e) => {
          console.warn('[SlotStorage] tx.onerror saving directory handle:', e);
          resolve();
        };
      } catch (err) {
        console.warn('[SlotStorage] store.put synchronous error:', err);
        resolve();
      }
    });
  } catch (err) {
    console.warn('[SlotStorage] Failed to persist directory handle to IndexedDB:', err);
  }
}

/**
 * Retrieve persisted DirectoryHandle from IndexedDB
 */
export async function getDirectoryHandleFromIDB(): Promise<any | null> {
  try {
    const db = await openSlotsDB();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(HANDLES_STORE_NAME, 'readonly');
        const store = tx.objectStore(HANDLES_STORE_NAME);
        const req = store.get(DIR_HANDLE_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
        tx.onerror = () => resolve(null);
        tx.onabort = () => resolve(null);
      } catch (err) {
        console.warn('[SlotStorage] store.get synchronous error:', err);
        resolve(null);
      }
    });
  } catch (err) {
    console.warn('[SlotStorage] Failed to retrieve directory handle from IndexedDB:', err);
    return null;
  }
}

/**
 * Clear persisted DirectoryHandle from IndexedDB
 */
export async function clearDirectoryHandleFromIDB(): Promise<void> {
  try {
    const db = await openSlotsDB();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(HANDLES_STORE_NAME, 'readwrite');
        const store = tx.objectStore(HANDLES_STORE_NAME);
        const req = store.delete(DIR_HANDLE_KEY);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
      } catch (err) {
        resolve();
      }
    });
  } catch (err) {
    console.warn('[SlotStorage] Failed to clear directory handle from IndexedDB:', err);
  }
}

/**
 * Clear all save slots and handles from IndexedDB
 */
export async function clearAllSlotsFromIDB(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openSlotsDB();
    return new Promise((resolve) => {
      try {
        const storeNames = [SLOTS_STORE_NAME, HANDLES_STORE_NAME].filter((s) => db.objectStoreNames.contains(s));
        if (storeNames.length === 0) {
          db.close();
          resolve();
          return;
        }
        const tx = db.transaction(storeNames, 'readwrite');
        storeNames.forEach((s) => {
          try {
            tx.objectStore(s).clear();
          } catch {}
        });
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
    console.warn('[SlotStorage] clearAllSlotsFromIDB caught notice:', err);
  }
}
