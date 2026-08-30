import { useEffect, useState } from 'react';
import { getWord, listWords } from '../lib/words';
import type { WordMeta } from '../lib/types';

/** 响应式读取单词本（监听 chrome.storage 变化） */
export function useWords(): {
  words: WordMeta[];
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const [words, setWords] = useState<WordMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setWords(await listWords());
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
    const onChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area === 'local' && 'words' in changes) void refresh();
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, []);

  return { words, loading, refresh };
}

/** 响应式读取单个单词 */
export function useWord(
  id: string | null,
): { word?: WordMeta; refresh: () => Promise<void> } {
  const [word, setWord] = useState<WordMeta | undefined>(undefined);
  const refresh = async () => {
    setWord(id ? await getWord(id) : undefined);
  };
  useEffect(() => {
    void refresh();
    const onChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area === 'local' && 'words' in changes) void refresh();
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, [id]);
  return { word, refresh };
}
