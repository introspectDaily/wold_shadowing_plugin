import { useEffect } from 'react';
import type { Phoneme } from '../lib/ipa-data';
import { PhonemeHead } from './PhonemeBody';
import { WordShadowCard } from './WordShadowCard';
import { UserWordAdder } from './UserWordAdder';
import { useIpaUserWords } from '../lib/ipaUserWords';
import { Icon } from './Icon';
import { warmUpMic, releaseMic } from '../lib/mic';

interface IpaPairDetailProps {
  a: Phoneme;
  b: Phoneme;
  label: string;
  hint: string;
  description: string;
  onBack: () => void;
}

function ShadowColumn({ phoneme }: { phoneme: Phoneme }) {
  const { map, remove } = useIpaUserWords();
  const userWords = map[phoneme.symbol] ?? [];

  return (
    <div className="ipa-compare-col">
      <PhonemeHead phoneme={phoneme} />
      <p className="ipa-description">{phoneme.description}</p>
      <div className="ws-list">
        {phoneme.words.map((w) => (
          <WordShadowCard key={w.word} word={w.word} phonetic={w.phonetic} />
        ))}
        {userWords.map((w) => (
          <WordShadowCard
            key={w.word}
            word={w.word}
            phonetic={w.phonetic}
            onDelete={() => void remove(phoneme.symbol, w.word)}
          />
        ))}
      </div>
      <div className="ws-adder">
        <div className="card-title">我的单词（可增删）</div>
        <UserWordAdder symbol={phoneme.symbol} />
      </div>
    </div>
  );
}

export function IpaPairDetail({
  a,
  b,
  label,
  hint,
  description,
  onBack,
}: IpaPairDetailProps) {
  // 进入跟读界面即预热麦克风，避免点击录音时才激活设备而产生“du”声
  useEffect(() => {
    warmUpMic();
    return () => releaseMic();
  }, []);

  return (
    <div className="ipa-pair-detail">
      <header className="ipa-detail-header">
        <button type="button" className="icon-btn" onClick={onBack} title="返回">
          <Icon name="back" size={16} />
        </button>
        <div>
          <div className="ipa-pair-label">{label}</div>
          <div className="ipa-pair-hint">{hint}</div>
        </div>
      </header>
      <p className="ipa-pair-desc">
        <Icon name="spark" size={11} />
        {description}
      </p>
      <div className="ipa-compare-table">
        <ShadowColumn phoneme={a} />
        <ShadowColumn phoneme={b} />
      </div>
    </div>
  );
}
