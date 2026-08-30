import { useMemo } from 'react';
import { useWords } from '../hooks/useWords';
import { useNow } from '../hooks/useNow';
import { applyReview, isDue } from '../lib/words';
import { STATUS_LABEL } from '../lib/status';
import type { ReviewQuality } from '../lib/types';
import { formatRelativeTime } from '../lib/format';

interface MemoryReviewProps {
  onOpenWord: (id: string) => void;
}

export function MemoryReview({ onOpenWord }: MemoryReviewProps) {
  const { words } = useWords();
  const now = useNow(30_000);

  const stats = useMemo(() => {
    const s = {
      all: words.length,
      due: 0,
      new: 0,
      learning: 0,
      reviewed: 0,
      mastered: 0,
    };
    for (const w of words) {
      if (isDue(w, now)) s.due++;
      s[w.status]++;
    }
    return s;
  }, [words, now]);

  const due = useMemo(
    () =>
      words
        .filter((w) => isDue(w, now))
        .sort((a, b) => (a.nextReviewAt ?? 0) - (b.nextReviewAt ?? 0)),
    [words, now],
  );

  const handleReview = async (id: string, quality: ReviewQuality) => {
    await applyReview(id, quality);
  };

  return (
    <div className="section">
      <h1 className="section-title">记忆复习</h1>
      <div className="review-stats">
        <div className="stat-chip due">
          <b>{stats.due}</b> 待复习
        </div>
        <div className="stat-chip">
          <b>{stats.new}</b> 新词
        </div>
        <div className="stat-chip">
          <b>{stats.learning}</b> 学习中
        </div>
        <div className="stat-chip">
          <b>{stats.reviewed}</b> 已复习
        </div>
        <div className="stat-chip">
          <b>{stats.mastered}</b> 已掌握
        </div>
      </div>

      {due.length === 0 ? (
        <div className="card empty">
          {stats.all === 0
            ? '单词本还是空的，先去「单词本」添加单词吧。'
            : '太棒了，当前没有到期需要复习的单词。'}
        </div>
      ) : (
        <div className="review-list">
          {due.map((w) => (
            <div className="card review-card" key={w.id}>
              <div className="review-card-head">
                <button
                  type="button"
                  className="review-card-word"
                  onClick={() => onOpenWord(w.id)}
                  title="打开单词详情"
                >
                  {w.text}
                </button>
                <span className={`status-badge status-${w.status}`}>
                  {STATUS_LABEL[w.status]}
                </span>
              </div>
              <div className="muted small review-card-meta">
                {w.dict?.phonetic && `/${w.dict.phonetic}/`}
                {w.reviewCount > 0
                  ? `已复习 ${w.reviewCount} 次`
                  : '还没复习过'}
                {w.lastReviewedAt
                  ? ` · 上次 ${formatRelativeTime(w.lastReviewedAt, now)}`
                  : ''}
              </div>
              <div className="review-buttons review-card-actions">
                <button
                  type="button"
                  className="review-btn again"
                  onClick={() => void handleReview(w.id, 'again')}
                  title="忘记，很快再复习"
                >
                  忘记
                </button>
                <button
                  type="button"
                  className="review-btn hard"
                  onClick={() => void handleReview(w.id, 'hard')}
                  title="有点模糊"
                >
                  模糊
                </button>
                <button
                  type="button"
                  className="review-btn good"
                  onClick={() => void handleReview(w.id, 'good')}
                  title="记住了"
                >
                  记得
                </button>
                <button
                  type="button"
                  className="review-btn easy"
                  onClick={() => void handleReview(w.id, 'easy')}
                  title="很熟悉，延长复习间隔"
                >
                  简单
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
