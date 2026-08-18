const DB_NAME = 'uvmap-online-db';
const DB_VERSION = 1;
const STORE = 'projects';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
        store.createIndex('deletedAt', 'deletedAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, callback) {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const result = await callback(store, tx);
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
    });
    return result;
  } finally {
    db.close();
  }
}

export async function listProjects({ trash = false } = {}) {
  const records = await withStore('readonly', store => requestToPromise(store.getAll()));
  return records
    .filter(item => trash ? Boolean(item.deletedAt) : !item.deletedAt)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export async function getProject(id) {
  return withStore('readonly', store => requestToPromise(store.get(id)));
}

export async function saveProject(project) {
  const payload = {
    ...project,
    updatedAt: Date.now(),
    createdAt: project.createdAt || Date.now(),
  };
  await withStore('readwrite', store => requestToPromise(store.put(payload)));
  return payload;
}

export async function moveToTrash(id) {
  const project = await getProject(id);
  if (!project) return;
  await saveProject({ ...project, deletedAt: Date.now() });
}

export async function restoreProject(id) {
  const project = await getProject(id);
  if (!project) return;
  const { deletedAt, ...rest } = project;
  await saveProject(rest);
}

export async function deleteProjectForever(id) {
  await withStore('readwrite', store => requestToPromise(store.delete(id)));
}

export async function purgeExpiredTrash(days = 30) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const trash = await listProjects({ trash: true });
  const expired = trash.filter(item => item.deletedAt && item.deletedAt < cutoff);
  for (const item of expired) {
    await deleteProjectForever(item.id);
  }
  return expired.length;
}

export async function estimateStorage() {
  if (!navigator.storage?.estimate) return null;
  const estimate = await navigator.storage.estimate();
  return {
    usage: estimate.usage || 0,
    quota: estimate.quota || 0,
  };
}

export async function requestPersistentStorage() {
  if (!navigator.storage?.persist) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export function createProjectId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `project-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}
