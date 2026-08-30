import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RecordingMeta } from '../lib/types';
import { formatDuration, formatRelativeTime } from '../lib/format';
import { Icon } from './Icon';
import { useAudio } from '../lib/useAudio';
import { useNow } from '../hooks/useNow';
import { useSettings } from '../lib/settings';

interface RecordingListProps {
  word: string;
  metas: RecordingMeta[];
  loading: boolean;
  /** 按 id 加载录音音频 Blob */
  loadRecording: (id: string) => Promise<Blob | undefined>;
  onTogglePin: (id: string, pinned: boolean) => void;
  onDelete: (id: string) => void;
}

export function RecordingList({
  word,
  metas,
  loading,
  loadRecording,
  onTogglePin,
  onDelete,
}: RecordingListProps) {
  const audio = useAudio();
  const { settings } = useSettings();
  const now = useNow(15_000);
  const [showAll, setShowAll] = useState(false);
  const urlCache = useRef(new Map<string, string>());

  useEffect(
    () => () => {
      for (const url of urlCache.current.values()) URL.revokeObjectURL(url);
      urlCache.current.clear();
    },
    [],
  );

  const pinned = useMemo(() => metas.filter((m) => m.pinned), [metas]);
  const unpinned = useMemo(() => metas.filter((m) => !m.pinned), [metas]);
  const latestUnpinned = useMemo(
    () => unpinned.slice(0, Math.max(0, 3 - pinned.length)),
    [unpinned, pinned.length],
  );
  const visible = useMemo(() => {
    if (showAll) return [...pinned, ...unpinned];
    return [...pinned, ...latestUnpinned];
  }, [pinned, unpinned, latestUnpinned, showAll]);

  const getUrl = useCallback(
    async (id: string) => {
      const hit = urlCache.current.get(id);
      if (hit) return hit;
      const blob = await loadRecording(id);
      if (!blob) return undefined;
      const url = URL.createObjectURL(blob);
      urlCache.current.set(id, url);
      return url;
    },
    [loadRecording],
  );

  const onPlay = useCallback(
    async (meta: RecordingMeta) => {
      const key = `rec-${meta.id}`;
      if (audio.isPlaying(key)) {
        audio.stop();
        return;
      }
      const url = await getUrl(meta.id);
      if (url) {
        const startAt = settings.noDuEnabled
          ? settings.playbackSkipMs / 1000
          : 0;
        audio.play(key, url, undefined, startAt);
      }
    },
    [audio, getUrl, settings],
  );

  const handleDelete = async (id: string) => {
    const url = urlCache.current.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      urlCache.current.delete(id);
    }
    audio.stop();
    onDelete(id);
  };

  if (loading) {
    return <div className="muted">加载跟读记录…</div>;
  }
  if (metas.length === 0) {
    return (
      <div className="empty">
        还没有跟读记录，点击上方按钮录下你的第一遍跟读
      </div>
    );
  }

  return (
    <div className="recording-list">
      {visible.map((meta) => {
        const playing = audio.isPlaying(`rec-${meta.id}`);
        const progress = playing ? audio.progress : 0;
        return (
          <div
            key={meta.id}
            className={`recording-item ${playing ? 'playing' : ''}`}
          >
            <button
              type="button"
              className="play-round"
              onClick={() => void onPlay(meta)}
              title={playing ? '暂停' : '播放'}
            >
              <Icon name={playing ? 'pause' : 'play'} size={14} />
            </button>
            <div className="recording-main">
              <div className="recording-row">
                <span className="recording-duration">
                  {formatDuration(meta.durationMs)}
                </span>
                <span className="muted">
                  {formatRelativeTime(meta.createdAt, now)}
                </span>
                {meta.pinned && (
                  <span className="pinned-tag">
                    <Icon name="pin" size={10} />
                    已标记
                  </span>
                )}
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${Math.min(100, progress * 100)}%` }}
                />
              </div>
            </div>
            <div className="recording-actions">
              <button
                type="button"
                className={`icon-btn ${meta.pinned ? 'active' : ''}`}
                onClick={() => onTogglePin(meta.id, !meta.pinned)}
                title={meta.pinned ? '取消标记' : '标记并永久保留'}
              >
                <Icon name="pin" size={14} />
              </button>
              <button
                type="button"
                className="icon-btn danger"
                onClick={() => void handleDelete(meta.id)}
                title="删除这条跟读"
              >
                <Icon name="trash" size={14} />
              </button>
            </div>
          </div>
        );
      })}
      {!showAll && metas.length > visible.length && (
        <button
          type="button"
          className="link-btn"
          onClick={() => setShowAll(true)}
        >
          查看全部 {metas.length} 条跟读
        </button>
      )}
      {showAll && (
        <button
          type="button"
          className="link-btn"
          onClick={() => setShowAll(false)}
        >
          收起（默认显示最新 3 条）
        </button>
      )}
      <div className="muted small">共 {metas.length} 条 · 标记的会一直保留</div>
    </div>
  );
}
