import { useEffect } from 'react';
import type { Phoneme } from '../lib/ipa-data';
import { PhonemeHead } from './PhonemeBody';
import { WordShadowCard } from './WordShadowCard';
import { PhonemeSoundEditor } from './PhonemeSoundEditor';
import { UserWordAdder } from './UserWordAdder';
import { useIpaUserWords } from '../lib/ipaUserWords';
import { warmUpMic, releaseMic } from '../lib/mic';
import { Icon } from './Icon';

interface PhonemeDetailProps {
  phoneme: Phoneme;
  onBack: () => void;
}

function UserWordsSection({ phoneme }: { phoneme: Phoneme }) {
  const { map, remove } = useIpaUserWords();
  const userWords = map[phoneme.symbol] ?? [];

  return (
    <section className="card">
      <div className="card-title">
        我的单词（可增删）
        <span className="muted small">{userWords.length} 个</span>
      </div>
      <UserWordAdder symbol={phoneme.symbol} />
      {userWords.length === 0 ? (
        <div className="muted small" style={{ marginTop: 8 }}>
          还没有自定义单词，可在上方输入单词添加到该音标。
        </div>
      ) : (
        <div className="ws-list">
          {userWords.map((w) => (
            <WordShadowCard
              key={w.word}
              word={w.word}
              phonetic={w.phonetic}
              onDelete={() => void remove(phoneme.symbol, w.word)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function PhonemeDetail({ phoneme, onBack }: PhonemeDetailProps) {
  // 进入详情即预热麦克风，避免点击录音时才激活设备而产生“du”声
  useEffect(() => {
    warmUpMic();
    return () => releaseMic();
  }, []);

  return (
    <div className="ipa-detail">
      <header className="ipa-detail-header">
        <button type="button" className="icon-btn" onClick={onBack} title="返回">
          <Icon name="back" size={16} />
        </button>
        <span className="ipa-detail-title">音标详情</span>
      </header>

      <section className="card">
        <PhonemeHead phoneme={phoneme} />
        <p className="ipa-description">{phoneme.description}</p>
        {phoneme.ref && (
          <p className="ipa-ref-inline muted small">参考：{phoneme.ref}</p>
        )}
        <div className="ws-list">
          {phoneme.words.map((w) => (
            <WordShadowCard key={w.word} word={w.word} phonetic={w.phonetic} />
          ))}
        </div>
      </section>

      <UserWordsSection phoneme={phoneme} />
      <PhonemeSoundEditor phoneme={phoneme} />
    </div>
  );
}
