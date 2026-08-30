export function uid(prefix = ''): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}${Date.now().toString(36)}-${rand}`;
}

/** 规范化单词：小写、去首尾空白 */
export function normalizeWord(word: string): string {
  return word.trim().toLowerCase();
}
