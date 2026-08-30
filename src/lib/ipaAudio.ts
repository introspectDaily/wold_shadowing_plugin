/**
 * 单独音标发音（人工支持）。
 * 有道等 API 只能朗读单词、无法朗读孤立的音标符号，因此这里允许人工为每个音标
 * 配置一段音频 URL（存于 chrome.storage.local），有配置时展示「播放音标发音」按钮。
 */
import { useEffect, useState } from 'react';
import type { Phoneme } from './ipa-data';

const KEY = 'ipaPhonemeAudio';

export type PhonemeAudioMap = Record<string, string>;

export async function getPhonemeAudioMap(): Promise<PhonemeAudioMap> {
  const v = await chrome.storage.local.get(KEY);
  return (v[KEY] as PhonemeAudioMap | undefined) ?? {};
}

export async function setPhonemeAudio(
  symbol: string,
  url: string,
): Promise<void> {
  const map = await getPhonemeAudioMap();
  const next: PhonemeAudioMap = { ...map };
  const trimmed = url.trim();
  if (trimmed) next[symbol] = trimmed;
  else delete next[symbol];
  await chrome.storage.local.set({ [KEY]: next });
}

/** 有效音频地址：优先用户配置，其次数据里的默认值 */
export function effectiveAudioUrl(
  phoneme: Phoneme,
  map: PhonemeAudioMap,
): string | undefined {
  return map[phoneme.symbol] || phoneme.audio;
}

/** 响应式读取/更新音标发音配置 */
export function usePhonemeAudio() {
  const [map, setMap] = useState<PhonemeAudioMap>({});

  useEffect(() => {
    void getPhonemeAudioMap().then(setMap);
    const onChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area === 'local' && KEY in changes) {
        setMap((changes[KEY].newValue as PhonemeAudioMap | undefined) ?? {});
      }
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, []);

  const setter = async (symbol: string, url: string) => {
    await setPhonemeAudio(symbol, url);
    setMap(await getPhonemeAudioMap());
  };

  return { map, setter };
}
