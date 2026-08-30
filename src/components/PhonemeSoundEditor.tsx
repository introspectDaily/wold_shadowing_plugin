import { useState } from 'react';
import type { Phoneme } from '../lib/ipa-data';
import { usePhonemeAudio, effectiveAudioUrl } from '../lib/ipaAudio';
import { useAudio } from '../lib/useAudio';
import { playCachedAudio } from '../lib/audioCache';
import { Icon } from './Icon';

interface PhonemeSoundEditorProps {
  phoneme: Phoneme;
}

/** 单独音标发音的人工配置：粘贴音频 URL → 保存 → 播放 */
export function PhonemeSoundEditor({ phoneme }: PhonemeSoundEditorProps) {
  const { map, setter } = usePhonemeAudio();
  const audio = useAudio();
  const configured = effectiveAudioUrl(phoneme, map);
  const [url, setUrl] = useState(configured ?? '');
  const [editing, setEditing] = useState(!configured);

  const onPlay = () => {
    if (!configured) return;
    const key = `ph-${phoneme.symbol}`;
    void playCachedAudio(audio, key, configured, () =>
      audio.play(key, configured),
    );
  };

  const save = () => {
    void setter(phoneme.symbol, url).then(() => setEditing(false));
  };

  return (
    <div className="card">
      <div className="card-title">音标单独发音（人工配置）</div>
      {configured && !editing ? (
        <div className="ph-sound-ok">
          <span className="muted small">
            已配置发音地址，点击右侧播放试听。
          </span>
          <div className="ph-sound-actions">
            <button type="button" className="accent-btn" onClick={onPlay}>
              <Icon name="volume" size={14} />
              播放
            </button>
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setUrl(configured);
                setEditing(true);
              }}
            >
              修改
            </button>
            <button
              type="button"
              className="link-btn danger"
              onClick={() => void setter(phoneme.symbol, '').then(() => setUrl(''))}
            >
              移除
            </button>
          </div>
        </div>
      ) : (
        <div className="ph-sound-edit">
          <input
            className="ph-sound-input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="粘贴该音标的音频地址（mp3/ogg/wav/…）"
          />
          <div className="ph-sound-actions">
            <button type="button" className="accent-btn" onClick={save}>
              <Icon name="check" size={14} />
              保存
            </button>
            {configured && (
              <button
                type="button"
                className="link-btn"
                onClick={() => setEditing(false)}
              >
                取消
              </button>
            )}
          </div>
          <div className="muted small ph-sound-tip">
            由于有道等接口只能朗读单词、无法朗读孤立音标，这里支持人工粘贴音标发音音频链接。
            配置后会在此音标出现的所有界面（音标表、对比、跟读页）显示「音标发音」按钮。
          </div>
        </div>
      )}
    </div>
  );
}
