import { useEffect, useState } from 'react';

export interface Settings {
  /** 是否消除录音开头的“du”杂音（源头不录入 + 播放兼容旧录音） */
  noDuEnabled: boolean;
  /** 录音前等待麦克风管线稳定的毫秒数（源头去 du） */
  sourceSkipMs: number;
  /** 播放时跳过的毫秒数（兼容已保存的旧录音） */
  playbackSkipMs: number;
  /** 标准发音 / 跟读回放的播放速度（0.5 ~ 2.0） */
  playbackRate: number;
}

export const DEFAULT_SETTINGS: Settings = {
  noDuEnabled: true,
  sourceSkipMs: 250,
  playbackSkipMs: 150,
  playbackRate: 1,
};

const KEY = 'settings';

export async function getSettings(): Promise<Settings> {
  const v = await chrome.storage.local.get(KEY);
  const s = v[KEY] as Partial<Settings> | undefined;
  return { ...DEFAULT_SETTINGS, ...(s ?? {}) };
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const cur = await getSettings();
  await chrome.storage.local.set({ [KEY]: { ...cur, ...patch } });
}

/** 响应式读取/更新设置（监听 chrome.storage 变化） */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  const refresh = async () => setSettings(await getSettings());

  useEffect(() => {
    void refresh();
    const onChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area === 'local' && KEY in changes) void refresh();
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, []);

  const setSetting = async <K extends keyof Settings>(
    key: K,
    value: Settings[K],
  ) => {
    await saveSettings({ [key]: value } as Partial<Settings>);
  };

  return { settings, setSetting, refresh };
}

/** 播放速度可选档位（快速选择） */
export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

/** 播放速度允许的最小值 */
export const PLAYBACK_RATE_MIN = 0.25;
/** 播放速度允许的最大值 */
export const PLAYBACK_RATE_MAX = 3;
/** 滑块的步进 */
export const PLAYBACK_RATE_STEP = 0.05;

/** 将播放速度限制在合法范围内 */
export function clampPlaybackRate(v: number): number {
  if (!Number.isFinite(v)) return 1;
  return Math.min(PLAYBACK_RATE_MAX, Math.max(PLAYBACK_RATE_MIN, v));
}
