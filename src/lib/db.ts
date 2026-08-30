/**
 * 轻量 IndexedDB 封装，用于存储跟读录音的音频 Blob。
 * 录音元数据也一并存在这里（保持单一数据源），单词本身存在 chrome.storage。
 */
import type { Recording, RecordingMeta } from './types';

const DB_NAME = 'word-shadowing-db';
const DB_VERSION = 1;
const STORE = 'recordings';
const META_STORE = 'recording-meta';

let dbPromise: Promise<IDBDatabase> | null = null;

type Listener = () => void;
const listeners = new Set<Listener>();

/** 订阅录音数据变化（IndexedDB 无原生事件，由写入方主动通知） */
export function subscribeRecordings(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notifyRecordingsChanged(): void {
  for (const fn of listeners) fn();
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('word', 'word', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        const store = db.createObjectStore(META_STORE, { keyPath: 'id' });
        store.createIndex('word', 'word', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(storeName, mode);
        const req = fn(t.objectStore(storeName));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

function getAllReq<T>(storeName: string, indexName?: string, key?: string): Promise<T[]> {
  return openDb().then(
    (db) =>
      new Promise<T[]>((resolve, reject) => {
        const t = db.transaction(storeName, 'readonly');
        const src = indexName ? t.objectStore(storeName).index(indexName) : t.objectStore(storeName);
        const req = key !== undefined ? src.getAll(key) : src.getAll();
        req.onsuccess = () => resolve(req.result as T[]);
        req.onerror = () => reject(req.error);
      }),
  );
}

function deleteReq(storeName: string, id: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const t = db.transaction(storeName, 'readwrite');
        const req = t.objectStore(storeName).delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      }),
  );
}

export interface SaveRecordingInput {
  id: string;
  word: string;
  createdAt: number;
  durationMs: number;
  blob: Blob;
}

export async function saveRecording(input: SaveRecordingInput): Promise<void> {
  await openDb();
  const rec: Recording = { ...input, pinned: false };
  const meta: RecordingMeta = {
    id: input.id,
    word: input.word,
    createdAt: input.createdAt,
    durationMs: input.durationMs,
    pinned: false,
    size: input.blob.size,
  };
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction([STORE, META_STORE], 'readwrite');
    t.objectStore(STORE).put(rec);
    t.objectStore(META_STORE).put(meta);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
  notifyRecordingsChanged();
}

export async function setRecordingPinned(
  id: string,
  pinned: boolean,
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction([STORE, META_STORE], 'readwrite');
    const getReq = t.objectStore(STORE).get(id);
    getReq.onsuccess = () => {
      const rec = getReq.result as Recording | undefined;
      if (rec) {
        rec.pinned = pinned;
        t.objectStore(STORE).put(rec);
        const metaReq = t.objectStore(META_STORE).get(id);
        metaReq.onsuccess = () => {
          const meta: RecordingMeta = (metaReq.result as RecordingMeta | undefined) ?? {
            id,
            word: rec.word,
            createdAt: rec.createdAt,
            durationMs: rec.durationMs,
            size: rec.blob.size,
            pinned,
          };
          meta.pinned = pinned;
          t.objectStore(META_STORE).put(meta);
        };
      }
    };
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
  notifyRecordingsChanged();
}

export async function deleteRecording(id: string): Promise<void> {
  await deleteReq(STORE, id);
  await deleteReq(META_STORE, id);
  notifyRecordingsChanged();
}

/** 读取某单词的全部录音 blob */
export async function getRecordings(word: string): Promise<Recording[]> {
  const all = await getAllReq<Recording>(STORE, 'word', word);
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getAllRecordingMetas(): Promise<RecordingMeta[]> {
  return getAllReq<RecordingMeta>(META_STORE);
}

export async function getRecordingMetas(word: string): Promise<RecordingMeta[]> {
  const all = await getAllReq<RecordingMeta>(META_STORE, 'word', word);
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

/** 删除某单词的全部录音 */
export async function deleteRecordingsForWord(word: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction([STORE, META_STORE], 'readwrite');
    for (const s of [STORE, META_STORE]) {
      const idx = t.objectStore(s).index('word');
      const req = idx.getAllKeys(word);
      req.onsuccess = () => {
        for (const key of req.result) t.objectStore(s).delete(key);
      };
    }
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
  notifyRecordingsChanged();
}

export async function getRecordingById(id: string): Promise<Recording | undefined> {
  return tx<Recording | undefined>(STORE, 'readonly', (s) => s.get(id));
}

export async function clearAllData(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction([STORE, META_STORE], 'readwrite');
    t.objectStore(STORE).clear();
    t.objectStore(META_STORE).clear();
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
  notifyRecordingsChanged();
}

export function createObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

export function revokeObjectUrl(url: string): void {
  URL.revokeObjectURL(url);
}
