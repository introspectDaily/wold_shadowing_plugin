import {
  VOWEL_PHONEMES,
  CONSONANT_PHONEMES,
  getPhoneme,
  type Phoneme,
} from '../lib/ipa-data';
import { Icon } from './Icon';

interface IpaChartProps {
  onSelect: (symbol: string) => void;
}

function PhonemeTile({ symbol, onSelect }: { symbol: string; onSelect: (s: string) => void }) {
  const p = getPhoneme(symbol);
  if (!p) return null;
  return (
    <button
      type="button"
      className="ipa-tile"
      onClick={() => onSelect(p.symbol)}
      title={p.name}
    >
      <span className="ipa-tile-symbol">{p.symbol}</span>
      <span className="ipa-tile-word">{p.words[0]?.word}</span>
    </button>
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
  groups,
  onSelect,
}: {
  title: string;
  groups: { sub: string; items: Phoneme[] }[];
  onSelect: (s: string) => void;
}) {
  return (
    <section className="card">
      <div className="card-title">{title}</div>
      {groups.map((g) => (
        <div className="ipa-group" key={g.sub}>
          <div className="ipa-group-label">{g.sub}</div>
          <div className="ipa-tile-grid">
            {g.items.map((p) => (
              <PhonemeTile key={p.symbol} symbol={p.symbol} onSelect={onSelect} />
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
        国际音标（IPA）教学表。单元音细分为长元音、短元音。点击任意音标查看发音要点、示例单词及每个单词的音标。
      </p>
      <Section title="元音 Vowels" groups={vowelGroups} onSelect={onSelect} />
      <Section title="辅音 Consonants" groups={consonantGroups} onSelect={onSelect} />
      <p className="muted small ipa-hint">
        <Icon name="spark" size={11} />
        提示：每个音标卡片下方标注了典型代表单词，点击即可进入该音标的专属练习页。
      </p>
    </div>
  );
}
