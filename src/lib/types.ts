/** 单词记忆状态 */
export type WordStatus = 'new' | 'learning' | 'reviewed' | 'mastered';

/** 单词元数据（存储在 chrome.storage.local） */
export interface WordMeta {
  /** 规范化后的单词（小写） */
  id: string;
  /** 原始拼写 */
  text: string;
  createdAt: number;
  updatedAt: number;
  /** 记忆状态 */
  status: WordStatus;
  /** 复习次数 */
  reviewCount: number;
  /** 当前复习间隔（天） */
  intervalDays?: number;
  lastReviewedAt?: number;
  /** 下次复习时间（毫秒时间戳） */
  nextReviewAt?: number;
  /** 缓存的词典信息（音标/释义），避免每次重复请求 */
  dict?: DictInfo;
}

/** 词典信息（来自 dictionaryapi.dev，含缓存） */
export interface DictInfo {
  word: string;
  phonetic?: string;
  /** 美式音标 */
  phoneticUs?: string;
  /** 英式音标 */
  phoneticUk?: string;
  phonetics: { text?: string; audio?: string }[];
  meanings: {
    partOfSpeech: string;
    definitions: { definition: string; example?: string }[];
  }[];
  fetchedAt: number;
}

/** 一条跟读录音（blob 存储在 IndexedDB） */
export interface Recording {
  id: string;
  word: string;
  createdAt: number;
  durationMs: number;
  /** 用户标记为“常用/保留”，永久显示 */
  pinned: boolean;
  blob: Blob;
}

/** 录音元数据（不含 blob，用于列表展示） */
export interface RecordingMeta {
  id: string;
  word: string;
  createdAt: number;
  durationMs: number;
  pinned: boolean;
  size: number;
}

/** 复习结果 */
export type ReviewQuality = 'again' | 'hard' | 'good' | 'easy';

/** 从弹出页/右键菜单传入待查询的单词 */
export interface PendingLookup {
  word: string;
  at: number;
}

/** 词典查询接口 */
export interface DictLookup {
  ok: boolean;
  error?: string;
  info?: DictInfo;
}
