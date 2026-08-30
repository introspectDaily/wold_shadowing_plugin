import { useState } from 'react';
import { getPhoneme, type IpaPair } from '../lib/ipa-data';
import { IpaChart } from './IpaChart';
import { IpaCompare } from './IpaCompare';
import { PhonemeDetail } from './PhonemeDetail';
import { IpaPairDetail } from './IpaPairDetail';
import { IpaReferences } from './IpaReferences';

type Tab = 'chart' | 'compare';

const TABS: { key: Tab; label: string }[] = [
  { key: 'chart', label: '音标表' },
  { key: 'compare', label: '易混淆对比' },
];

export function IpaTeaching() {
  const [tab, setTab] = useState<Tab>('chart');
  const [selected, setSelected] = useState<string | null>(null);
  const [pair, setPair] = useState<IpaPair | null>(null);

  const phoneme = selected ? getPhoneme(selected) : undefined;
  const a = pair ? getPhoneme(pair.a) : undefined;
  const b = pair ? getPhoneme(pair.b) : undefined;

  // 易混淆对比详情页：展示最全信息 + 支持跟读
  if (pair && a && b) {
    return (
      <IpaPairDetail
        a={a}
        b={b}
        label={pair.label}
        hint={pair.hint}
        description={pair.description}
        onBack={() => setPair(null)}
      />
    );
  }

  if (phoneme) {
    return <PhonemeDetail phoneme={phoneme} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="section ipa-teaching">
      <h1 className="section-title">音标教学</h1>
      <div className="filter-chips ipa-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`chip ${tab === t.key ? 'active' : ''}`}
            onClick={() => {
              setTab(t.key);
              setPair(null);
              setSelected(null);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'chart' ? (
        <IpaChart onSelect={setSelected} />
      ) : (
        <IpaCompare onOpen={setPair} />
      )}
      <IpaReferences />
    </div>
  );
}
