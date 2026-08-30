/**
 * 标准发音音频缓存。
 * 有道 dictvoice 音频每次点击都会重新请求网络，这里把它缓存到 IndexedDB，
 * 同一单词同一口音只需下载一次，之后直接播放本地 blob。
 */
const DB_NAME = 'word-shadowing-audio-cache';
const DB_VERSION = 1;
const STORE = 'audio';
/** 缓存条目上限，超出时删除最旧的，避免无限增长 */
const MAX_ENTRIES = 600;

interface AudioCacheEntry {
  key: string; // `${word}|${accent}`
  blob: Blob;
  createdAt: number;
  size: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function getAudioBlob(key: string): Promise<Blob | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readonly');
    const req = t.objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as AudioCacheEntry | undefined)?.blob);
    req.onerror = () => reject(req.error);
  });
}

export async function saveAudioBlob(key: string, blob: Blob): Promise<void> {
  const db = await openDb();
  const entry: AudioCacheEntry = { key, blob, createdAt: Date.now(), size: blob.size };
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite');
    t.objectStore(STORE).put(entry);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
  await trimCache(db);
}

/** 超出上限时删除最旧的条目 */
async function trimCache(db: IDBDatabase): Promise<void> {
  const all = await new Promise<AudioCacheEntry[]>((resolve, reject) => {
    const t = db.transaction(STORE, 'readonly');
    const req = t.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as AudioCacheEntry[]);
    req.onerror = () => reject(req.error);
  });
  if (all.length <= MAX_ENTRIES) return;
  const sorted = [...all].sort((a, b) => a.createdAt - b.createdAt);
  const toDelete = sorted.slice(0, all.length - MAX_ENTRIES);
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite');
    for (const e of toDelete) t.objectStore(STORE).delete(e.key);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function clearAudioCache(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite');
    t.objectStore(STORE).clear();
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

/** useAudio 的最小播放接口（避免循环依赖） */
interface Playable {
  play(key: string, url: string, handlers?: { onError?: () => void }): void;
  isPlaying(key: string): boolean;
  stop(): void;
}

// 每个 key 正在使用的 object URL；替换时先 revoke，避免内存泄漏
const objectUrls = new Map<string, string>();

function makeUrl(key: string, blob: Blob): string {
  const prev = objectUrls.get(key);
  if (prev) URL.revokeObjectURL(prev);
  const url = URL.createObjectURL(blob);
  objectUrls.set(key, url);
  return url;
}

/**
 * 缓存感知的播放：
 * - 已在播放同一 key → 停止；
 * - 缓存命中 → 播放本地 blob（不再请求网络）；
 * - 未命中 → 下载并缓存后播放；下载失败则走 onError 兜底（如浏览器 TTS）。
 */
export async function playCachedAudio(
  audio: Playable,
  key: string,
  url: string,
  onError?: () => void,
): Promise<void> {
  if (audio.isPlaying(key)) {
    audio.stop();
    return;
  }
  const cached = await getAudioBlob(key);
  if (cached) {
    audio.play(key, makeUrl(key, cached), { onError });
    return;
  }
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    if (blob.size === 0) throw new Error('empty audio');
    await saveAudioBlob(key, blob);
    audio.play(key, makeUrl(key, blob), { onError });
  } catch {
    // 下载失败（离线/接口异常）：交给调用方兜底（浏览器本地语音）
    onError?.();
  }
}
