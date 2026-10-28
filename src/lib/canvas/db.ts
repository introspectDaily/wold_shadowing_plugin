/**
 * 无限画布笔记的 IndexedDB 存储层。
 *
 * 单独一个数据库（`word-shadowing-canvas`），不和跟读录音的
 * `word-shadowing-db` 混在一起：两套数据的生命周期完全不同，
 * 分开可以各自升级 schema，互不影响。
 */
import type { Asset, Notebook, Page, PageNodes, Section } from './types';

const DB_NAME = 'word-shadowing-canvas';
const DB_VERSION = 1;

const STORE_NOTEBOOKS = 'notebooks';
const STORE_SECTIONS = 'sections';
const STORE_PAGES = 'pages';
const STORE_PAGE_NODES = 'page-nodes';
const STORE_ASSETS = 'assets';
const STORE_META = 'meta';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NOTEBOOKS)) {
        db.createObjectStore(STORE_NOTEBOOKS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SECTIONS)) {
        const s = db.createObjectStore(STORE_SECTIONS, { keyPath: 'id' });
        s.createIndex('notebookId', 'notebookId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_PAGES)) {
        const s = db.createObjectStore(STORE_PAGES, { keyPath: 'id' });
        s.createIndex('sectionId', 'sectionId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_PAGE_NODES)) {
        db.createObjectStore(STORE_PAGE_NODES, { keyPath: 'pageId' });
      }
      if (!db.objectStoreNames.contains(STORE_ASSETS)) {
        db.createObjectStore(STORE_ASSETS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

/** 等待一整个事务完成，避免「写入还没落盘就关闭页面」 */
async function run<T>(
  stores: string | string[],
  mode: IDBTransactionMode,
  fn: (tx: IDBTransaction) => Promise<T> | T,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    let result: T;
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
    Promise.resolve(fn(tx))
      .then((r) => {
        result = r;
      })
      .catch((err) => {
        reject(err);
        try {
          tx.abort();
        } catch {
          /* ignore */
        }
      });
  });
}

function reqAsPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getAt<T>(tx: IDBTransaction, store: string, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

function allAt<T>(tx: IDBTransaction, store: string): Promise<T[]> {
  return reqAsPromise<T[]>(tx.objectStore(store).getAll() as IDBRequest<T[]>);
}

function allByIndex<T>(tx: IDBTransaction, store: string, index: string, key: IDBValidKey): Promise<T[]> {
  return reqAsPromise<T[]>(
    tx.objectStore(store).index(index).getAll(key) as IDBRequest<T[]>,
  );
}

const byCreatedAt = <T extends { createdAt: number }>(a: T, b: T) => a.createdAt - b.createdAt;

/* ------------------------------- 笔记本 ------------------------------- */

export async function listNotebooks(): Promise<Notebook[]> {
  const all = await run(STORE_NOTEBOOKS, 'readonly', (tx) => allAt<Notebook>(tx, STORE_NOTEBOOKS));
  return all.sort(byCreatedAt);
}

export function putNotebook(notebook: Notebook): Promise<void> {
  return run(STORE_NOTEBOOKS, 'readwrite', (tx) => {
    tx.objectStore(STORE_NOTEBOOKS).put(notebook);
  });
}

export async function deleteNotebook(id: string): Promise<void> {
  const sections = await listSections(id);
  for (const s of sections) await deleteSection(s.id);
  await run(STORE_NOTEBOOKS, 'readwrite', (tx) => {
    tx.objectStore(STORE_NOTEBOOKS).delete(id);
  });
}

/* -------------------------------- 分区 -------------------------------- */

export async function listSections(notebookId: string): Promise<Section[]> {
  const all = await run(STORE_SECTIONS, 'readonly', (tx) =>
    allByIndex<Section>(tx, STORE_SECTIONS, 'notebookId', notebookId),
  );
  return all.sort(byCreatedAt);
}

export function putSection(section: Section): Promise<void> {
  return run(STORE_SECTIONS, 'readwrite', (tx) => {
    tx.objectStore(STORE_SECTIONS).put(section);
  });
}

export async function getSection(id: string): Promise<Section | undefined> {
  return run(STORE_SECTIONS, 'readonly', (tx) => getAt<Section>(tx, STORE_SECTIONS, id));
}

export async function deleteSection(id: string): Promise<void> {
  const pages = await listPages(id);
  for (const p of pages) await deletePage(p.id);
  await run(STORE_SECTIONS, 'readwrite', (tx) => {
    tx.objectStore(STORE_SECTIONS).delete(id);
  });
}

/* --------------------------------- 页 --------------------------------- */

export async function listPages(sectionId: string): Promise<Page[]> {
  const all = await run(STORE_PAGES, 'readonly', (tx) =>
    allByIndex<Page>(tx, STORE_PAGES, 'sectionId', sectionId),
  );
  // 有手动排序就按 order，没有就回退到创建时间
  return all.sort((a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt));
}

/** 重排列：一次性把新的顺序写回去 */
export async function reorderPages(pages: Page[]): Promise<void> {
  await run(STORE_PAGES, 'readwrite', (tx) => {
    const store = tx.objectStore(STORE_PAGES);
    pages.forEach((p, i) => store.put({ ...p, order: i }));
  });
}

export function putPage(page: Page): Promise<void> {
  return run(STORE_PAGES, 'readwrite', (tx) => {
    tx.objectStore(STORE_PAGES).put(page);
  });
}

export async function getPage(id: string): Promise<Page | undefined> {
  return run(STORE_PAGES, 'readonly', (tx) => getAt<Page>(tx, STORE_PAGES, id));
}

export async function deletePage(id: string): Promise<void> {
  await run([STORE_PAGES, STORE_PAGE_NODES], 'readwrite', (tx) => {
    tx.objectStore(STORE_PAGES).delete(id);
    tx.objectStore(STORE_PAGE_NODES).delete(id);
  });
}

/* ------------------------------- 页内容 ------------------------------- */

export async function getPageNodes(pageId: string): Promise<PageNodes | undefined> {
  return run(STORE_PAGE_NODES, 'readonly', (tx) =>
    getAt<PageNodes>(tx, STORE_PAGE_NODES, pageId),
  );
}

export function putPageNodes(pageId: string, nodes: PageNodes['nodes']): Promise<void> {
  const record: PageNodes = { pageId, nodes, updatedAt: Date.now() };
  return run(STORE_PAGE_NODES, 'readwrite', (tx) => {
    tx.objectStore(STORE_PAGE_NODES).put(record);
  });
}

/* -------------------------------- 资源 -------------------------------- */

export function putAsset(blob: Blob, id: string): Promise<void> {
  const record: Asset = { id, blob, type: blob.type, createdAt: Date.now() };
  return run(STORE_ASSETS, 'readwrite', (tx) => {
    tx.objectStore(STORE_ASSETS).put(record);
  });
}

export async function getAsset(id: string): Promise<Asset | undefined> {
  return run(STORE_ASSETS, 'readonly', (tx) => getAt<Asset>(tx, STORE_ASSETS, id));
}

export function deleteAsset(id: string): Promise<void> {
  return run(STORE_ASSETS, 'readwrite', (tx) => {
    tx.objectStore(STORE_ASSETS).delete(id);
  });
}

/* --------------------------------- 元信息 ------------------------------ */

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const rec = await run(STORE_META, 'readonly', (tx) =>
    getAt<{ key: string; value: T }>(tx, STORE_META, key),
  );
  return rec?.value;
}

export function setMeta<T>(key: string, value: T): Promise<void> {
  return run(STORE_META, 'readwrite', (tx) => {
    tx.objectStore(STORE_META).put({ key, value });
  });
}
