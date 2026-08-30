import { useRecorder } from '../hooks/useRecorder';
import { Icon } from './Icon';
import { formatDuration } from '../lib/format';
import { useSettings } from '../lib/settings';

interface RecorderWidgetProps {
  onSave: (blob: Blob, durationMs: number) => Promise<void> | void;
  disabled?: boolean;
}

export function RecorderWidget({ onSave, disabled }: RecorderWidgetProps) {
  const { settings } = useSettings();
  const { state, start, stop, cancel, elapsedMs, error } = useRecorder(
    settings.noDuEnabled ? settings.sourceSkipMs : 0,
  );
  const recording = state === 'recording';
  const starting = state === 'starting';

  const handleStop = async () => {
    const blob = await stop();
    if (blob && blob.size > 0) {
      await onSave(blob, elapsedMs || 1000);
    }
  };

  return (
    <div className={`recorder ${recording ? 'is-recording' : ''}`}>
      <div className="recorder-controls">
        {!recording ? (
          <button
            type="button"
            className="record-btn"
            disabled={disabled || starting}
            onClick={() => void start()}
            title="开始跟读录音"
          >
            <Icon name="mic" size={18} />
            <span>
              {starting ? '准备麦克风…' : state === 'error' ? '重试' : '开始跟读'}
            </span>
          </button>
        ) : (
          <>
            <button
              type="button"
              className="record-btn stop"
              onClick={() => void handleStop()}
              title="停止并保存"
            >
              <Icon name="pause" size={18} />
              <span>保存 {formatDuration(elapsedMs)}</span>
            </button>
            <button
              type="button"
              className="cancel-btn"
              onClick={cancel}
              title="丢弃本次录音"
            >
              <Icon name="close" size={14} />
              取消
            </button>
          </>
        )}
      </div>
      {recording && (
        <div className="recording-hint">
          <span className="dot" />
          正在录音，跟着标准发音朗读一遍
        </div>
      )}
      {error && <div className="error-text">{error}</div>}
    </div>
  );
}
