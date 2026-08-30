/**
 * 音标总览（特别总览）的配置：
 * - 每个音标左键点击时播放的 example 单词清单（用户可右键自定义）
 * - 全局：美音/英音、播放方式（一次播清单 / 逐个循环）
 */
import { useEffect, useState } from 'react';
import { getPhoneme } from './ipa-data';

export type Accent = 'us' | 'uk';
/** all = 一次点击播放整个单词清单；one = 一次点击播一个词，再次点击播清单下一个（清单内循环） */
export type PlayMode = 'all' | 'one';

export interface OverviewConfig {
  accent: Accent;
  mode: PlayMode;
  /** 播放时是否显示屏幕固定字幕（默认开启） */
  subtitleEnabled: boolean;
  /** 字幕展示时长（秒）；0 = 一直显示（无限） */
  subtitleDuration: number;
  /** symbol -> 该音标左键点击时播放的单词清单（默认 = 该音标全部 example 单词） */
  wordLists: Record<string, string[]>;
}

/** 字幕时长快捷档位（秒）；0 表示无限 */
export const SUBTITLE_DURATION_PRESETS = [0, 1, 5];
/** 字幕时长允许的最大值（秒） */
export const SUBTITLE_DURATION_MAX = 60;

export function clampSubtitleDuration(v: number): number {
  if (!Number.isFinite(v) || v < 0) return 0;
  return Math.min(SUBTITLE_DURATION_MAX, v);
}

export const DEFAULT_OVERVIEW_CONFIG: OverviewConfig = {
  accent: 'us',
  mode: 'all',
  subtitleEnabled: true,
  subtitleDuration: 5,
  wordLists: {},
};

const KEY = 'ipaOverviewConfig';

export async function getOverviewConfig(): Promise<OverviewConfig> {
  const v = await chrome.storage.local.get(KEY);
  const c = v[KEY] as Partial<OverviewConfig> | undefined;
  return { ...DEFAULT_OVERVIEW_CONFIG, ...(c ?? {}) };
}

export async function saveOverviewConfig(
  patch: Partial<OverviewConfig>,
): Promise<void> {
  const cur = await getOverviewConfig();
  await chrome.storage.local.set({ [KEY]: { ...cur, ...patch } });
}

/** 某音标实际播放的单词清单：优先用户自定义，否则用内置 example 单词 */
export function effectiveWords(
  symbol: string,
  config: OverviewConfig,
): string[] {
  const custom = config.wordLists?.[symbol];
  if (custom && custom.length > 0) return custom;
  return getPhoneme(symbol)?.words.map((w) => w.word) ?? [];
}

/** 响应式读取/更新总览配置 */
export function useOverviewConfig() {
  const [config, setConfig] = useState<OverviewConfig>(DEFAULT_OVERVIEW_CONFIG);

  const refresh = async () => setConfig(await getOverviewConfig());

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

  const setAccent = async (accent: Accent) => {
    await saveOverviewConfig({ accent });
  };
  const setMode = async (mode: PlayMode) => {
    await saveOverviewConfig({ mode });
  };
  const setWordList = async (symbol: string, words: string[]) => {
    const wordLists = { ...(config.wordLists ?? {}) };
    wordLists[symbol] = words;
    await saveOverviewConfig({ wordLists });
  };
  const setSubtitleEnabled = async (v: boolean) => {
    await saveOverviewConfig({ subtitleEnabled: v });
  };
  const setSubtitleDuration = async (v: number) => {
    await saveOverviewConfig({ subtitleDuration: clampSubtitleDuration(v) });
  };

  return {
    config,
    setAccent,
    setMode,
    setWordList,
    setSubtitleEnabled,
    setSubtitleDuration,
    refresh,
  };
}
