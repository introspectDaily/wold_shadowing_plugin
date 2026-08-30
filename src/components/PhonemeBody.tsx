import type { Phoneme } from '../lib/ipa-data';
import { youdaoAudioUrl, speakWithBrowser } from '../lib/dict';
import { useAudio } from '../lib/useAudio';
import { playCachedAudio } from '../lib/audioCache';
import { usePhonemeAudio, effectiveAudioUrl } from '../lib/ipaAudio';
import { Icon } from './Icon';
import { WordPhonetics } from './WordPhonetics';

export function PhonemeHead({ phoneme }: { phoneme: Phoneme }) {
  const audio = useAudio();
  const { map } = usePhonemeAudio();
  const audioUrl = effectiveAudioUrl(phoneme, map);

  const onPlaySound = () => {
    if (!audioUrl) return;
    const key = `ph-${phoneme.symbol}`;
    void playCachedAudio(audio, key, audioUrl, () =>
      speakWithBrowser(phoneme.symbol, 'us'),
    );
  };

  return (
    <div className="phoneme-head">
      <span className="ipa-symbol-lg">{phoneme.symbol}</span>
      <div className="ipa-detail-meta">
        <span className="ipa-name">{phoneme.name}</span>
        <div className="ipa-meta-tags">
          <span className={`ipa-type-tag ipa-type-${phoneme.type}`}>
            {phoneme.type === 'vowel' ? '元音' : '辅音'}
          </span>
          <span className="ipa-subcat">{phoneme.subcategory}</span>
        </div>
      </div>
      {audioUrl && (
        <button
          type="button"
          className="ipa-sound-btn"
          onClick={onPlaySound}
          title="播放该音标的单独发音"
        >
          <Icon name="volume" size={15} />
          音标发音
        </button>
      )}
    </div>
  );
}

interface PhonemeBodyProps {
  phoneme: Phoneme;
  /** 对比模式下更紧凑的样式 */
  compact?: boolean;
  /** 是否联网获取英/美音标分别标注（详情页用；总览页关闭） */
  fetchPhonetics?: boolean;
}

export function PhonemeBody({ phoneme, compact, fetchPhonetics }: PhonemeBodyProps) {
  const audio = useAudio();

  const onPlayWord = (word: string, accent: 'us' | 'uk') => {
    const key = `${accent}-${word}`;
    void playCachedAudio(audio, key, youdaoAudioUrl(word, accent), () =>
      speakWithBrowser(word, accent),
    );
  };

  return (
    <div className={`phoneme-body ${compact ? 'compact' : ''}`}>
      <PhonemeHead phoneme={phoneme} />
      <p className="ipa-description">{phoneme.description}</p>
      {phoneme.ref && (
        <p className="ipa-ref-inline muted small">
          参考：{phoneme.ref}
        </p>
      )}

      <div className="ipa-word-grid">
        {phoneme.words.map((w) => (
          <div className="ipa-word-card" key={w.word}>
            <div className="ipa-word-top">
              <span className="ipa-word-text">{w.word}</span>
              <span className="ipa-word-phonetic">
                <WordPhonetics
                  word={w.word}
                  fallback={w.phonetic}
                  fetch={fetchPhonetics}
                />
              </span>
            </div>
            <div className="ipa-word-actions">
              <button
                type="button"
                className="accent-btn"
                onClick={() => onPlayWord(w.word, 'us')}
                title="美式发音"
              >
                <Icon name="volume" size={14} />
                美
              </button>
              <button
                type="button"
                className="accent-btn"
                onClick={() => onPlayWord(w.word, 'uk')}
                title="英式发音"
              >
                <Icon name="volume" size={14} />
                英
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
