import { useRef, useState } from 'react';
import { useAudio } from './useAudio';
import { playCachedAudio } from './audioCache';
import { youdaoAudioUrl, speakWithBrowser } from './dict';

export interface OverviewPlaying {
  symbol: string;
  word: string;
}

/**
 * 总览播放控制：
 * - mode='all'：一次点击按顺序播放整个单词清单；
 * - mode='one'：一次点击播一个词，再次点击播清单下一个（清单内循环）。
 * 左键点击同一音标时，若正在播放则停止。
 * 暴露当前正在播放的 (symbol, word)，供字幕展示。
 */
export function useOverviewPlay() {
  const audio = useAudio();
  // 记录每个音标当前的播放进度（symbol -> 下一个要播的单词下标）
  const cursorRef = useRef<Record<string, number>>({});
  const activeRef = useRef<string | null>(null);
  const [current, setCurrent] = useState<OverviewPlaying | null>(null);

  const stop = () => {
    audio.stop();
    activeRef.current = null;
    setCurrent(null);
  };

  const playAll = (symbol: string, words: string[], accent: 'us' | 'uk') => {
    if (audio.isPlaying(`ov-${symbol}`)) {
      stop();
      return;
    }
    const playIndex = (i: number) => {
      const w = words[i];
      if (!w) {
        activeRef.current = null;
        setCurrent(null);
        return;
      }
      setCurrent({ symbol, word: w });
      const key = `${accent}-${w}`;
      void playCachedAudio(
        audio,
        key,
        youdaoAudioUrl(w, accent),
        {
          onEnded: () => {
            if (activeRef.current === `ov-${symbol}`) playIndex(i + 1);
          },
          onError: () => speakWithBrowser(w, accent),
        },
      );
    };
    activeRef.current = `ov-${symbol}`;
    playIndex(0);
  };

  const playOne = (symbol: string, words: string[], accent: 'us' | 'uk') => {
    const key = `ov-${symbol}`;
    if (audio.isPlaying(key)) {
      stop();
      return;
    }
    if (activeRef.current !== key) {
      // 第一次点击该音标：从第 0 个开始
      cursorRef.current[symbol] = 0;
      activeRef.current = key;
    }
    const i = cursorRef.current[symbol] ?? 0;
    const w = words[i];
    if (!w) {
      activeRef.current = null;
      setCurrent(null);
      return;
    }
    setCurrent({ symbol, word: w });
    // 下次点击播下一个（清单内循环）
    cursorRef.current[symbol] = (i + 1) % words.length;
    const playKey = `${accent}-${w}`;
    void playCachedAudio(audio, playKey, youdaoAudioUrl(w, accent), {
      onError: () => speakWithBrowser(w, accent),
    });
  };

  const play = (
    symbol: string,
    words: string[],
    mode: 'all' | 'one',
    accent: 'us' | 'uk',
  ) => {
    if (mode === 'all') playAll(symbol, words, accent);
    else playOne(symbol, words, accent);
  };

  return {
    play,
    stop,
    current,
    isPlaying: (symbol: string) => audio.isPlaying(`ov-${symbol}`),
  };
}
