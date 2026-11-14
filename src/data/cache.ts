/**
 * Tiny IndexedDB key/value cache for climate series (localStorage is too small for ~9k days × 6 fields).
 * Every access is wrapped: private mode / blocked storage simply means "no cache".
 */
const DB = 'fihrist';
const STORE = 'climate';
const VERSION = 1;
export const CACHE_TTL_MS = 30 * 24 * 3600 * 1000; // POWER daily history changes rarely

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB, VERSION);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const db = await open();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      req.onsuccess = () => {
        const v = req.result as { t: number; v: T } | undefined;
        resolve(v && typeof v.t === 'number' && Date.now() - v.t < CACHE_TTL_MS ? v.v : null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function cachePut<T>(key: string, value: T): Promise<void> {
  const db = await open();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ t: Date.now(), v: value }, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
