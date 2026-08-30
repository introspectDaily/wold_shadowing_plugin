import { useCallback, useEffect, useState } from 'react';
import type { DictInfo, ReviewQuality } from '../lib/types';
import { applyReview, updateWord } from '../lib/words';
import { lookupWord } from '../lib/dict';
import { deleteRecording, saveRecording, setRecordingPinned } from '../lib/db';
import { uid } from '../lib/ids';
import { useWord } from '../hooks/useWords';
import { useRecordings } from '../hooks/useRecordings';
import { useNow } from '../hooks/useNow';
import { Icon } from './Icon';
import { PronounceBar } from './PronounceBar';
import { RecorderWidget } from './RecorderWidget';
import { RecordingList } from './RecordingList';
import { formatCountdown, formatRelativeTime } from '../lib/format';
import { releaseMic, warmUpMic } from '../lib/mic';
import { STATUS_LABEL } from '../lib/status';

interface WordDetailProps {
  wordId: string;
  compact?: boolean;
  onBack?: () => void;
  onRemove?: (id: string) => void;
}

export function WordDetail({ wordId, compact, onBack, onRemove }: WordDetailProps) {
  const { word, refresh } = useWord(wordId);
  const recordings = useRecordings(wordId);
  const now = useNow(30_000);
  const [dict, setDict] = useState<DictInfo | undefined>(word?.dict);
  const [dictState, setDictState] = useState<'idle' | 'loading' | 'ok' | 'error'>(
    word?.dict ? 'ok' : 'idle',
  );
  const [dictError, setDictError] = useState<string>();

  // 进入单词详情即预热麦克风，让“du”发生在打开界面时而不是点击录音时
  useEffect(() => {
    warmUpMic();
    return () => releaseMic();
  }, []);

  const loadDict = useCallback(async () => {
    if (!wordId) return;
    setDictState('loading');
    const res = await lookupWord(wordId);
    if (res.ok && res.info) {
      setDict(res.info);
      setDictState('ok');
      void updateWord(wordId, { dict: res.info });
    } else {
      setDictError(res.error);
      setDictState('error');
    }
  }, [wordId]);

  useEffect(() => {
    if (wordId && dictState === 'idle') void loadDict();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wordId, dictState]);

  const handleSaveRecording = async (blob: Blob, durationMs: number) => {
    await saveRecording({
      id: uid('rec-'),
      word: wordId,
      createdAt: Date.now(),
      durationMs,
      blob,
    });
  };

  const handleReview = async (quality: ReviewQuality) => {
    await applyReview(wordId, quality);
    await refresh();
  };

  const handleTogglePin = async (id: string, pinned: boolean) => {
    await setRecordingPinned(id, pinned);
  };

  const handleDelete = async (id: string) => {
    await deleteRecording(id);
  };

  if (!word) {
    return <div className="empty">单词不存在或已被删除</div>;
  }

  const due = (word.nextReviewAt ?? 0) <= now;

  return (
    <div className="word-detail">
      <header className="detail-header">
        {onBack && (
          <button type="button" className="icon-btn" onClick={onBack} title="返回">
            <Icon name="back" size={16} />
          </button>
        )}
        <h2 className="word-title">{word.text}</h2>
        <span className={`status-badge status-${word.status}`}>
          {STATUS_LABEL[word.status]}
        </span>
        {onRemove && (
          <button
            type="button"
            className="icon-btn danger"
            onClick={() => onRemove(word.id)}
            title="从单词本删除"
          >
            <Icon name="trash" size={15} />
          </button>
        )}
      </header>

      <PronounceBar
        word={word.text}
        phonetic={dict?.phonetic}
        phoneticUs={dict?.phoneticUs}
        phoneticUk={dict?.phoneticUk}
      />

      <section className="card dict-card">
        <div className="card-title">
          释义
          {dictState === 'error' && (
            <button type="button" className="link-btn" onClick={() => void loadDict()}>
              重试
            </button>
          )}
        </div>
        {dictState === 'loading' && <div className="muted">查询释义中…</div>}
        {dictState === 'error' && (
          <div className="error-text">{dictError ?? '释义查询失败'}</div>
        )}
        {dictState === 'ok' && dict && (
          <div className="meanings">
            {dict.meanings.length === 0 && (
              <div className="muted">没有找到释义</div>
            )}
            {dict.meanings.map((m, i) => (
              <div className="meaning" key={i}>
                <span className="pos">{m.partOfSpeech}</span>
                <ul>
                  {m.definitions.map((d, j) => (
                    <li key={j}>
                      <span>{d.definition}</span>
                      {d.example && <em className="example">{d.example}</em>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-title">跟读练习</div>
        <RecorderWidget onSave={handleSaveRecording} disabled={!wordId} />
        <RecordingList
          word={wordId}
          metas={recordings.metas}
          loading={recordings.loading}
          loadRecording={async (id) => (await recordings.loadRecording(id))?.blob}
          onTogglePin={handleTogglePin}
          onDelete={handleDelete}
        />
      </section>

      <section className="card">
        <div className="card-title">
          记忆
          {word.reviewCount > 0 && (
            <span className="muted small">
              已复习 {word.reviewCount} 次 · 上次{' '}
              {formatRelativeTime(word.lastReviewedAt ?? 0, now)}
            </span>
          )}
        </div>
        <div className="memory-status">
          <span className="muted">
            {word.reviewCount === 0
              ? '还没复习过'
              : due
                ? '今天该复习了'
                : `下次复习 ${formatCountdown((word.nextReviewAt ?? 0) - now)}`}
          </span>
        </div>
        <div className="review-buttons">
          <button
            type="button"
            className="review-btn again"
            onClick={() => void handleReview('again')}
            title="忘记，很快再复习"
          >
            忘记
          </button>
          <button
            type="button"
            className="review-btn hard"
            onClick={() => void handleReview('hard')}
            title="有点模糊"
          >
            模糊
          </button>
          <button
            type="button"
            className="review-btn good"
            onClick={() => void handleReview('good')}
            title="记住了"
          >
            记得
          </button>
          <button
            type="button"
            className="review-btn easy"
            onClick={() => void handleReview('easy')}
            title="很熟悉，延长复习间隔"
          >
            简单
          </button>
        </div>
      </section>
    </div>
  );
}
