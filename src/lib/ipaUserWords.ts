/**
 * 用户自增单词：允许用户在某个音标下增加/删除自己的单词，
 * 系统内置单词（ipa-data）只读、不可修改。用户单词存于 chrome.storage.local。
 */
import { useEffect, useState } from 'react';
import { lookupWord } from './dict';

export interface IpaUserWord {
  word: string;
  phonetic: string;
}

const KEY = 'ipaUserWords';
/** symbol -> 用户单词列表 */
export type IpaUserWordMap = Record<string, IpaUserWord[]>;

export async function getIpaUserWords(): Promise<IpaUserWordMap> {
  const v = await chrome.storage.local.get(KEY);
  return (v[KEY] as IpaUserWordMap | undefined) ?? {};
}

export async function addIpaUserWord(
  symbol: string,
  word: string,
  phonetic: string,
): Promise<void> {
  const map = await getIpaUserWords();
  const list = (map[symbol] ?? []).filter((w) => w.word !== word);
  list.push({ word, phonetic });
  map[symbol] = list;
  await chrome.storage.local.set({ [KEY]: map });
}

export async function removeIpaUserWord(
  symbol: string,
  word: string,
): Promise<void> {
  const map = await getIpaUserWords();
  map[symbol] = (map[symbol] ?? []).filter((w) => w.word !== word);
  await chrome.storage.local.set({ [KEY]: map });
}

/** 自动获取单词音标（有道/词典）；失败返回空字符串 */
export async function getWordPhonetic(word: string): Promise<string> {
  try {
    const res = await lookupWord(word);
    const ph = res.info?.phonetic;
    return ph ? `/${ph}/` : '';
  } catch {
    return '';
  }
}

/** 响应式读取/更新用户单词 */
export function useIpaUserWords() {
  const [map, setMap] = useState<IpaUserWordMap>({});

  useEffect(() => {
    void getIpaUserWords().then(setMap);
    const onChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area === 'local' && KEY in changes) {
        setMap((changes[KEY].newValue as IpaUserWordMap | undefined) ?? {});
      }
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, []);

  const refresh = async () => setMap(await getIpaUserWords());

  const add = async (symbol: string, word: string, phonetic: string) => {
    await addIpaUserWord(symbol, word, phonetic);
    await refresh();
  };

  const remove = async (symbol: string, word: string) => {
    await removeIpaUserWord(symbol, word);
    await refresh();
  };

  return { map, add, remove, refresh };
}
