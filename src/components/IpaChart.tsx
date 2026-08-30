import {
  VOWEL_PHONEMES,
  CONSONANT_PHONEMES,
  getPhoneme,
  type Phoneme,
} from '../lib/ipa-data';
import { useAudio } from '../lib/useAudio';
import { playCachedAudio } from '../lib/audioCache';
import { youdaoAudioUrl, speakWithBrowser } from '../lib/dict';
import { Icon } from './Icon';

interface IpaChartProps {
  onSelect: (symbol: string) => void;
}

function PhonemeCard({ symbol, onSelect }: { symbol: string; onSelect: (s: string) => void }) {
  const audio = useAudio();
  const p = getPhoneme(symbol);
  if (!p) return null;

  const play = (word: string, accent: 'us' | 'uk') => {
    const key = `${accent}-${word}`;
    void playCachedAudio(audio, key, youdaoAudioUrl(word, accent), () =>
      speakWithBrowser(word, accent),
    );
  };

  return (
    <div className="ipa-chart-card" onClick={() => onSelect(p.symbol)} title={p.name}>
      <div className="ipa-chart-card-head">
        <span className="ipa-symbol">{p.symbol}</span>
        <div className="ipa-chart-card-meta">
          <span className="ipa-name">{p.name}</span>
          <div className="ipa-meta-tags">
            <span className={`ipa-type-tag ipa-type-${p.type}`}>
              {p.type === 'vowel' ? '元音' : '辅音'}
            </span>
            <span className="ipa-subcat">{p.subcategory}</span>
          </div>
        </div>
      </div>
      <div className="ipa-word-grid">
        {p.words.map((w) => (
          <div className="ipa-word-card" key={w.word}>
            <div className="ipa-word-top">
              <span className="ipa-word-text">{w.word}</span>
              <span className="ipa-word-phonetic">{w.phonetic}</span>
            </div>
            <div className="ipa-word-actions">
              <button
                type="button"
                className="accent-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  play(w.word, 'us');
                }}
                title="美式发音"
              >
                <Icon name="volume" size={12} />
                美
              </button>
              <button
                type="button"
                className="accent-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  play(w.word, 'uk');
                }}
                title="英式发音"
              >
                <Icon name="volume" size={12} />
                英
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function groupBySubcategory(list: Phoneme[]): { sub: string; items: Phoneme[] }[] {
  const order: string[] = [];
  const map = new Map<string, Phoneme[]>();
  for (const p of list) {
    if (!map.has(p.subcategory)) {
      map.set(p.subcategory, []);
      order.push(p.subcategory);
    }
    map.get(p.subcategory)!.push(p);
  }
  return order.map((sub) => ({ sub, items: map.get(sub)! }));
}

function Section({
  title,
  prefix,
  groups,
  onSelect,
}: {
  title: string;
  prefix: string;
  groups: { sub: string; items: Phoneme[] }[];
  onSelect: (s: string) => void;
}) {
  return (
    <section className="card">
      <div className="card-title">{title}</div>
      {groups.map((g) => (
        <div className="ipa-group" key={g.sub} id={`${prefix}-${g.sub}`}>
          <div className="ipa-group-label">{g.sub}</div>
          <div className="ipa-chart-grid">
            {g.items.map((p) => (
              <PhonemeCard key={p.symbol} symbol={p.symbol} onSelect={onSelect} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

export function IpaChart({ onSelect }: IpaChartProps) {
  const vowelGroups = groupBySubcategory(VOWEL_PHONEMES);
  const consonantGroups = groupBySubcategory(CONSONANT_PHONEMES);

  return (
    <div className="ipa-chart">
      <p className="ipa-intro">
        国际音标（IPA）教学表。单元音细分为长元音、短元音。每个音标卡片展示了示例单词，
        可先听标准发音；点击卡片进入该音标的专属练习页。
      </p>
      <Section title="元音 Vowels" prefix="vowel" groups={vowelGroups} onSelect={onSelect} />
      <Section title="辅音 Consonants" prefix="cons" groups={consonantGroups} onSelect={onSelect} />
      <p className="muted small ipa-hint">
        <Icon name="spark" size={11} />
        提示：卡片上的美/英按钮可单独听示例单词发音，点击卡片其余区域进入该音标的专属练习页。
      </p>
    </div>
  );
}
