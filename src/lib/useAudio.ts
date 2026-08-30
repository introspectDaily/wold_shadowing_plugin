import { useCallback, useEffect, useRef, useState } from 'react';
import { useSettings } from './settings';

/**
 * 单个播放器状态：同一时刻只播放一个音频。
 * play(key, url) 时若 key 相同则切换播放/暂停。
 * 播放速度默认跟随全局设置（settings.playbackRate）。
 */
export function useAudio() {
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { settings } = useSettings();

  const stop = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingKey(null);
    setProgress(0);
  }, []);

  const play = useCallback(
    (
      key: string,
      url: string,
      handlers?: { onEnded?: () => void; onError?: () => void },
      startAtSeconds = 0,
      rate?: number,
    ) => {
      if (playingKey === key) {
        stop();
        return;
      }
      audioRef.current?.pause();
      const audio = new Audio(url);
      audio.preload = 'auto';
      // 播放速度：优先调用方指定，否则用全局设置
      audio.playbackRate = rate ?? settings.playbackRate;
      audioRef.current = audio;
      audio.onplaying = () => setPlayingKey(key);
      audio.onpause = () => {
        if (audioRef.current === audio) setPlayingKey(null);
      };
      audio.onended = () => {
        if (audioRef.current === audio) {
          setPlayingKey(null);
          setProgress(1);
        }
        handlers?.onEnded?.();
      };
      audio.onerror = () => {
        if (audioRef.current === audio) {
          setPlayingKey(null);
          handlers?.onError?.();
        }
      };
      audio.ontimeupdate = () => {
        if (audio.duration) setProgress(audio.currentTime / audio.duration);
      };
      audio.onloadedmetadata = () => setDurationMs(audio.duration * 1000);
      const startPlay = () => {
        audio.play().catch(() => {
          if (audioRef.current === audio) setPlayingKey(null);
        });
      };
      if (startAtSeconds > 0) {
        // 等元数据加载后再跳到指定位置播放，避免开头杂音先被播出来
        audio.addEventListener(
          'loadedmetadata',
          () => {
            try {
              if (
                Number.isFinite(audio.duration) &&
                audio.duration > startAtSeconds
              ) {
                audio.currentTime = startAtSeconds;
              }
            } catch {
              /* ignore */
            }
            startPlay();
          },
          { once: true },
        );
      } else {
        startPlay();
      }
    },
    [playingKey, stop, settings.playbackRate],
  );

  useEffect(() => stop, [stop]);

  return {
    playingKey,
    progress,
    durationMs,
    play,
    stop,
    isPlaying: (key: string) => playingKey === key,
  };
}
