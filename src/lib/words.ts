/**
 * 单词本 + 记忆（间隔重复）逻辑，存储在 chrome.storage.local。
 */
import type { ReviewQuality, WordMeta, WordStatus } from './types';
import { normalizeWord, uid } from './ids';

const WORDS_KEY = 'words';

async function readAll(): Promise<WordMeta[]> {
  const v = await chrome.storage.local.get(WORDS_KEY);
  return (v[WORDS_KEY] as WordMeta[]) ?? [];
}

async function writeAll(words: WordMeta[]): Promise<void> {
  await chrome.storage.local.set({ [WORDS_KEY]: words });
}

export async function listWords(): Promise<WordMeta[]> {
  const words = await readAll();
  return words.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getWord(id: string): Promise<WordMeta | undefined> {
  const words = await readAll();
  return words.find((w) => w.id === id);
}

export async function addWord(raw: string): Promise<WordMeta> {
  const id = normalizeWord(raw);
  if (!id) throw new Error('单词不能为空');
  const words = await readAll();
  const existing = words.find((w) => w.id === id);
  if (existing) {
    existing.updatedAt = Date.now();
    await writeAll(words);
    return existing;
  }
  const now = Date.now();
  const word: WordMeta = {
    id,
    text: raw.trim(),
    createdAt: now,
    updatedAt: now,
    status: 'new',
    reviewCount: 0,
    nextReviewAt: now,
  };
  words.push(word);
  await writeAll(words);
  return word;
}

export async function removeWord(id: string): Promise<void> {
  const words = await readAll();
  await writeAll(words.filter((w) => w.id !== id));
}

export async function updateWord(
  id: string,
  patch: Partial<Omit<WordMeta, 'id' | 'text' | 'createdAt'>>,
): Promise<WordMeta | undefined> {
  const words = await readAll();
  const w = words.find((x) => x.id === id);
  if (!w) return undefined;
  Object.assign(w, patch, { updatedAt: Date.now() });
  await writeAll(words);
  return w;
}

const DAY = 24 * 60 * 60 * 1000;
const MAX_INTERVAL = 365;

function nextInterval(current: number, quality: ReviewQuality): number {
  switch (quality) {
    case 'again':
      return 0;
    case 'hard':
      return Math.min(MAX_INTERVAL, Math.max(1, Math.round(current * 1.5)));
    case 'good':
      return Math.min(MAX_INTERVAL, current === 0 ? 1 : Math.round(current * 2));
    case 'easy':
      return Math.min(MAX_INTERVAL, current === 0 ? 3 : Math.round(current * 3));
  }
}

/** 应用一次复习，更新记忆状态与下次复习时间 */
export async function applyReview(
  id: string,
  quality: ReviewQuality,
): Promise<WordMeta | undefined> {
  const words = await readAll();
  const w = words.find((x) => x.id === id);
  if (!w) return undefined;
  const now = Date.now();
  const intervalDays = nextInterval(w.intervalDays ?? 0, quality);
  w.reviewCount += 1;
  w.lastReviewedAt = now;
  w.intervalDays = intervalDays;
  w.nextReviewAt = now + intervalDays * DAY;

  let status: WordStatus;
  if (quality === 'again') {
    status = w.reviewCount <= 1 ? 'new' : 'learning';
  } else if (intervalDays >= 21) {
    status = 'mastered';
  } else if (intervalDays >= 1) {
    status = 'reviewed';
  } else {
    status = 'learning';
  }
  w.status = status;
  w.updatedAt = now;
  await writeAll(words);
  return w;
}

export function isDue(word: WordMeta, now = Date.now()): boolean {
  return (word.nextReviewAt ?? 0) <= now;
}

export async function clearWords(): Promise<void> {
  await chrome.storage.local.remove(WORDS_KEY);
}

export { uid };
