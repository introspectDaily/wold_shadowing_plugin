import { Icon } from './Icon';
import { useAudio } from '../lib/useAudio';
import { speakWithBrowser, youdaoAudioUrl } from '../lib/dict';

interface PronounceBarProps {
  word: string;
  phonetic?: string;
  /** 美式音标（来自有道页面时直接复用） */
  phoneticUs?: string;
  /** 英式音标（来自有道页面时直接复用） */
  phoneticUk?: string;
  compact?: boolean;
}

export function PronounceBar({
  word,
  phonetic,
  phoneticUs,
  phoneticUk,
}: PronounceBarProps) {
  const audio = useAudio();

  const onPlay = (accent: 'us' | 'uk') => {
    const key = `${accent}-${word}`;
    if (audio.isPlaying(key)) {
      audio.stop();
      return;
    }
    audio.play(key, youdaoAudioUrl(word, accent), {
      onError: () => speakWithBrowser(word, accent),
    });
  };

  return (
    <div className="pronounce-bar">
      <div className="phonetics">
        {phoneticUs && (
          <span className="phonetic">
            <i className="accent-label">美</i>/{phoneticUs}/
          </span>
        )}
        {phoneticUk && (
          <span className="phonetic">
            <i className="accent-label">英</i>/{phoneticUk}/
          </span>
        )}
        {!phoneticUs && !phoneticUk && phonetic && (
          <span className="phonetic">/{phonetic}/</span>
        )}
      </div>
      <div className="accent-buttons">
        <button
          type="button"
          className="accent-btn"
          onClick={() => onPlay('us')}
          title="美式发音"
        >
          <Icon name="volume" size={15} />
          美
        </button>
        <button
          type="button"
          className="accent-btn"
          onClick={() => onPlay('uk')}
          title="英式发音"
        >
          <Icon name="volume" size={15} />
          英
        </button>
      </div>
    </div>
  );
}
