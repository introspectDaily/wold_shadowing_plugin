import { useMemo, useState } from 'react';
import type { WordMeta, WordStatus } from '../lib/types';
import { isDue } from '../lib/words';
import { useNow } from '../hooks/useNow';
import { usePinnedCounts } from '../hooks/usePinnedCounts';
import { Icon } from './Icon';
import { STATUS_LABEL } from '../lib/status';

interface WordListProps {
  words: WordMeta[];
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}

type Filter = 'all' | WordStatus | 'due' | 'pinned';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'due', label: '待复习' },
  { key: 'new', label: '新词' },
  { key: 'learning', label: '学习中' },
  { key: 'reviewed', label: '已复习' },
  { key: 'mastered', label: '已掌握' },
  { key: 'pinned', label: '有标记' },
];

export function WordList({ words, onSelect, onRemove }: WordListProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const now = useNow(60_000);
  const pinnedCounts = usePinnedCounts();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return words.filter((w) => {
      if (q && !w.text.toLowerCase().includes(q)) return false;
      switch (filter) {
        case 'due':
          return isDue(w, now);
        case 'pinned':
          return (pinnedCounts[w.id] ?? 0) > 0;
        default:
          return filter === 'all' || w.status === filter;
      }
    });
  }, [words, query, filter, now, pinnedCounts]);

  if (words.length === 0) {
    return (
      <div className="empty">
        单词本是空的。在顶部搜索一个单词，或选中网页里的单词后右键查询。
      </div>
    );
  }

  return (
    <div className="word-list">
      <div className="filter-chips">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`chip ${filter === f.key ? 'active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>
      {filtered.length === 0 && <div className="empty">没有匹配的单词</div>}
      {filtered.map((w) => {
        const due = isDue(w, now);
        const pinned = pinnedCounts[w.id] ?? 0;
        return (
          <div className="word-row" key={w.id} onClick={() => onSelect(w.id)}>
            <div className="word-row-main">
              <div className="word-row-title">
                <span className="word-text">{w.text}</span>
                {due && w.reviewCount > 0 && (
                  <span className="due-tag">
                    <Icon name="clock" size={10} />
                    待复习
                  </span>
                )}
              </div>
              <div className="muted small">
                {w.dict?.phonetic ? `/${w.dict.phonetic}/` : ''}
                {pinned > 0 && (
                  <span className="pinned-count">
                    <Icon name="pin" size={10} />
                    {pinned}
                  </span>
                )}
              </div>
            </div>
            <div className="word-row-side">
              <span className={`status-badge status-${w.status}`}>
                {STATUS_LABEL[w.status]}
              </span>
              <button
                type="button"
                className="icon-btn danger"
                title="从单词本删除"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(w.id);
                }}
              >
                <Icon name="trash" size={13} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
