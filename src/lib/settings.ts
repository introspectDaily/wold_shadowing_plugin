import { useEffect, useState } from 'react';

export interface Settings {
  /** 是否消除录音开头的“du”杂音（源头不录入 + 播放兼容旧录音） */
  noDuEnabled: boolean;
  /** 录音前等待麦克风管线稳定的毫秒数（源头去 du） */
  sourceSkipMs: number;
  /** 播放时跳过的毫秒数（兼容已保存的旧录音） */
  playbackSkipMs: number;
}

export const DEFAULT_SETTINGS: Settings = {
  noDuEnabled: true,
  sourceSkipMs: 250,
  playbackSkipMs: 150,
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
