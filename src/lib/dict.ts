/**
 * 词典与标准发音服务。
 * - 释义/音标：有道词典 jsonapi（和发音/网页同源，速度快；dictionaryapi.dev 兜底）
 * - 标准发音：有道词典 dictvoice（US/UK 两种口音），浏览器 speechSynthesis 兜底
 */
import type { DictInfo, DictLookup } from './types';
import { normalizeWord } from './ids';
import { parseDefinitionText } from './youdao-extract';

const DICT_CACHE_KEY = 'dictCache';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 天

async function readCache(): Promise<Record<string, DictInfo>> {
  const v = await chrome.storage.local.get(DICT_CACHE_KEY);
  return (v[DICT_CACHE_KEY] as Record<string, DictInfo>) ?? {};
}

async function writeCache(cache: Record<string, DictInfo>): Promise<void> {
  await chrome.storage.local.set({ [DICT_CACHE_KEY]: cache });
}

/** 有道词典标准发音 URL */
export function youdaoAudioUrl(word: string, accent: 'us' | 'uk'): string {
  return `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=${accent === 'us' ? 1 : 2}`;
}

export async function lookupWord(raw: string): Promise<DictLookup> {
  const word = normalizeWord(raw);
  if (!word) return { ok: false, error: '请输入单词' };
  const cache = await readCache();
  const hit = cache[word];
  if (hit && Date.now() - hit.fetchedAt < CACHE_TTL) {
    return { ok: true, info: hit };
  }

  // 优先有道自己的接口：和标准发音、有道网页同源，网络路径短、速度快
  const youdao = await lookupYoudao(word);
  if (youdao.ok && youdao.info) {
    cache[word] = youdao.info;
    await writeCache(cache);
    return youdao;
  }
  // 兜底：dictionaryapi.dev
  const fallback = await lookupDictionaryApi(word);
  if (fallback.ok && fallback.info) {
    cache[word] = fallback.info;
    await writeCache(cache);
  }
  return fallback;
}

async function lookupYoudao(word: string): Promise<DictLookup> {
  try {
    // 只请求 ec（简明释义）字典，响应从 100KB+ 降到 ~1KB
    const dicts = encodeURIComponent(
      JSON.stringify({ count: 99, dicts: [['ec']] }),
    );
    const res = await fetch(
      `https://dict.youdao.com/jsonapi?q=${encodeURIComponent(word)}&dicts=${dicts}`,
    );
    if (!res.ok) return { ok: false, error: `有道词典异常（${res.status}）` };
    const data = (await res.json()) as YoudaoJsonApi;
    const info = normalizeYoudao(data, word);
    if (info) return { ok: true, info };
    return { ok: false, error: '没有找到这个词的释义' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '网络请求失败' };
  }
}

async function lookupDictionaryApi(word: string): Promise<DictLookup> {
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
    );
    if (res.status === 404) return { ok: false, error: '没有找到这个词的释义' };
    if (!res.ok) return { ok: false, error: `词典服务异常（${res.status}）` };
    const data = (await res.json()) as DictionaryApiEntry[];
    const info = normalizeDict(data, word);
    if (info.meanings.length === 0 && !info.phonetic) {
      return { ok: false, error: '没有找到这个词的释义' };
    }
    return { ok: true, info };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '网络请求失败' };
  }
}

interface YoudaoJsonApi {
  ec?: {
    word?: Array<{
      usphone?: string;
      ukphone?: string;
      trs?: Array<{
        tr?: Array<{ l?: { i?: string[] } }>;
      }>;
    }>;
  };
}

/** 解析有道 jsonapi 的 ec 数据：英美音标 + 简明释义（trs） */
export function normalizeYoudao(
  data: YoudaoJsonApi,
  word: string,
): DictInfo | null {
  const entry = data.ec?.word?.[0];
  if (!entry) return null;
  const phoneticUk = entry.ukphone;
  const phoneticUs = entry.usphone;
  const meanings: DictInfo['meanings'] = [];
  for (const t of entry.trs ?? []) {
    const full = t.tr?.[0]?.l?.i?.[0] ?? '';
    if (!full.trim()) continue;
    const parsed = parseDefinitionText(full);
    const senses = parsed.text
      .split('；')
      .map((s) => s.trim())
      .filter(Boolean);
    meanings.push({
      partOfSpeech: parsed.pos ?? '',
      definitions: senses.map((definition) => ({ definition })),
    });
  }
  if (meanings.length === 0 && !phoneticUk && !phoneticUs) return null;
  return {
    word,
    phonetic: phoneticUk ?? phoneticUs,
    phoneticUs,
    phoneticUk,
    phonetics: [
      ...(phoneticUk ? [{ text: phoneticUk }] : []),
      ...(phoneticUs ? [{ text: phoneticUs }] : []),
    ],
    meanings,
    fetchedAt: Date.now(),
  };
}

interface DictionaryApiEntry {
  word: string;
  phonetic?: string;
  phonetics?: { text?: string; audio?: string }[];
  meanings?: {
    partOfSpeech: string;
    definitions?: { definition: string; example?: string }[];
  }[];
}

function normalizeDict(data: DictionaryApiEntry[], word: string): DictInfo {
  const entry: Partial<DictionaryApiEntry> = data[0] ?? {};
  const phonetics =
    entry.phonetics
      ?.filter((p) => p.text || p.audio)
      .slice(0, 4)
      .map((p) => ({ text: p.text, audio: p.audio })) ?? [];
  const phonetic =
    entry.phonetic ||
    phonetics.find((p) => p.text)?.text ||
    data.find((d) => d.phonetic)?.phonetic;
  const meanings =
    entry.meanings?.map((m) => ({
      partOfSpeech: m.partOfSpeech,
      definitions: (m.definitions ?? []).slice(0, 3).map((d) => ({
        definition: d.definition,
        example: d.example,
      })),
    })) ?? [];
  return {
    word,
    phonetic,
    phoneticUs: undefined,
    phoneticUk: undefined,
    phonetics,
    meanings,
    fetchedAt: Date.now(),
  };
}

/** 用浏览器本地语音兜底朗读（无网络时的降级方案） */
export function speakWithBrowser(word: string, accent: 'us' | 'uk' = 'us'): void {
  if (typeof speechSynthesis === 'undefined') return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(word);
  const voices = speechSynthesis.getVoices();
  const preferred = voices.find(
    (v) =>
      v.lang.toLowerCase().startsWith(accent === 'uk' ? 'en-gb' : 'en-us'),
  );
  if (preferred) u.voice = preferred;
  u.lang = preferred?.lang ?? (accent === 'uk' ? 'en-GB' : 'en-US');
  u.rate = 0.9;
  speechSynthesis.speak(u);
}

/**
 * 播放一个音频 URL（通过 <audio>），返回停止函数。
 * 失败时静默返回，调用方可决定兜底。
 */
export function playUrl(url: string): { stop: () => void; done: Promise<void> } {
  const audio = new Audio(url);
  audio.preload = 'auto';
  const done = new Promise<void>((resolve) => {
    audio.onended = () => resolve();
    audio.onerror = () => resolve();
  });
  audio.play().catch(() => {
    /* 调用方兜底 */
  });
  return {
    stop: () => {
      audio.pause();
      audio.src = '';
    },
    done,
  };
}

/** 播放标准发音：优先有道音频，失败则用浏览器语音 */
export function playStandardPronunciation(
  word: string,
  accent: 'us' | 'uk',
): Promise<void> {
  return new Promise((resolve) => {
    const audio = new Audio(youdaoAudioUrl(word, accent));
    audio.preload = 'auto';
    let settled = false;
    const finish = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    audio.onended = finish;
    audio.onerror = finish;
    audio.play().catch(() => {
      speakWithBrowser(word, accent);
      finish();
    });
  });
}
