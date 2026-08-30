import { useEffect, useState } from 'react';
import { getAllRecordingMetas, subscribeRecordings } from '../lib/db';

/** word -> 已标记（pinned）的跟读数量 */
export function usePinnedCounts(): Record<string, number> {
  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    const load = async () => {
      const metas = await getAllRecordingMetas();
      const map: Record<string, number> = {};
      for (const m of metas) {
        if (m.pinned) map[m.word] = (map[m.word] ?? 0) + 1;
      }
      setCounts(map);
    };
    void load();
    return subscribeRecordings(() => void load());
  }, []);
  return counts;
}
