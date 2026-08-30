import { useEffect, useRef, useState } from 'react';
import {
  useSettings,
  PLAYBACK_RATES,
  PLAYBACK_RATE_MIN,
  PLAYBACK_RATE_MAX,
  PLAYBACK_RATE_STEP,
  clampPlaybackRate,
} from '../lib/settings';
import { Icon } from './Icon';

function fmt(v: number): string {
  const r = Math.round(v * 100) / 100;
  return r === 1 ? '1x' : `${r}x`;
}

/** 播放速度控制：滑块 + 自定义数值输入 + 快捷档位 */
export function SpeedControl() {
  const { settings, setSetting } = useSettings();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  const current = clampPlaybackRate(settings.playbackRate);

  useEffect(() => {
    if (!open) return;
    setInput(String(current));
  }, [open, current]);

  const apply = (v: number) => {
    void setSetting('playbackRate', clampPlaybackRate(v));
  };

  const submitInput = () => {
    const n = parseFloat(input.replace('x', '').trim());
    if (Number.isNaN(n)) {
      setInput(String(current));
      return;
    }
    const c = clampPlaybackRate(n);
    setInput(String(c));
    apply(c);
  };

  const onSlider = (v: number) => {
    setInput(String(v));
    apply(v);
  };

  return (
    <div
      className="speed-control"
      ref={wrapRef}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="speed-control-btn"
        onClick={() => setOpen((o) => !o)}
        title="播放速度"
      >
        <Icon name="clock" size={14} />
        <span>{fmt(current)}</span>
      </button>
      {open && (
        <div className="speed-control-menu">
          <div className="speed-control-title">播放速度</div>

          <div className="speed-current-row">
            <input
              type="number"
              className="speed-input"
              min={PLAYBACK_RATE_MIN}
              max={PLAYBACK_RATE_MAX}
              step={PLAYBACK_RATE_STEP}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onBlur={submitInput}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitInput();
              }}
            />
            <span className="speed-unit">×</span>
          </div>

          <input
            type="range"
            className="speed-slider"
            min={PLAYBACK_RATE_MIN}
            max={PLAYBACK_RATE_MAX}
            step={PLAYBACK_RATE_STEP}
            value={current}
            onChange={(e) => onSlider(parseFloat(e.target.value))}
          />

          <div className="speed-range-labels">
            <span>{PLAYBACK_RATE_MIN}x</span>
            <span>{PLAYBACK_RATE_MAX}x</span>
          </div>

          <div className="speed-presets">
            {PLAYBACK_RATES.map((rate) => (
              <button
                key={rate}
                type="button"
                className={`speed-option ${rate === current ? 'active' : ''}`}
                onClick={() => {
                  setInput(String(rate));
                  apply(rate);
                }}
              >
                {rate === 1 ? '正常' : `${rate}x`}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
