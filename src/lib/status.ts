import type { WordStatus } from './types';

export const STATUS_LABEL: Record<WordStatus, string> = {
  new: '新词',
  learning: '学习中',
  reviewed: '已复习',
  mastered: '已掌握',
};
