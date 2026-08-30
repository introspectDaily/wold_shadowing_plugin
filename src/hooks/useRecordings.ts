import { useCallback, useEffect, useState } from 'react';
import {
  getRecordingById,
  getRecordingMetas,
  subscribeRecordings,
} from '../lib/db';
import type { Recording, RecordingMeta } from '../lib/types';

interface UseRecordingsResult {
  metas: RecordingMeta[];
  loading: boolean;
  /** 加载某条录音的音频（含 Blob） */
  loadRecording: (id: string) => Promise<Recording | undefined>;
}

/** 响应式读取某单词的全部录音元数据 */
export function useRecordings(word: string): UseRecordingsResult {
  const [metas, setMetas] = useState<RecordingMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const list = word ? await getRecordingMetas(word) : [];
    setMetas(list);
    setLoading(false);
  }, [word]);

  useEffect(() => {
    setLoading(true);
    void refresh();
    return subscribeRecordings(() => void refresh());
  }, [refresh]);

  const loadRecording = useCallback(
    (id: string) => getRecordingById(id),
    [],
  );

  return { metas, loading, loadRecording };
}
