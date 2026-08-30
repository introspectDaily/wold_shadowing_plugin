import { useEffect, useState } from 'react';

/** 每 30 秒更新的当前时间戳，用于“到期复习”等相对时间展示 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
