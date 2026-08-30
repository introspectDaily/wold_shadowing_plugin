import { useEffect, useRef, useState } from 'react';
import {
  VOWEL_PHONEMES,
  CONSONANT_PHONEMES,
  IPA_PAIRS,
  getPhoneme,
  type IpaPair,
  type Phoneme,
} from '../lib/ipa-data';
import { IpaOverview } from './IpaOverview';
import { IpaChart } from './IpaChart';
import { IpaCompare } from './IpaCompare';
import { PhonemeDetail } from './PhonemeDetail';
import { IpaPairDetail } from './IpaPairDetail';
import { IpaReferences } from './IpaReferences';
import { OutlineNav, type OutlineItem } from './OutlineNav';

type Tab = 'overview' | 'chart' | 'compare';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: '特别总览' },
  { key: 'chart', label: '音标表' },
  { key: 'compare', label: '易混淆对比' },
];

/** 找到实际滚动的容器（独立页为 .standalone-main） */
function getScroller(): HTMLElement {
  const el = document.querySelector<HTMLElement>('.standalone-main');
  return el ?? (document.scrollingElement as HTMLElement);
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

function pairId(pair: IpaPair): string {
  return `pair-${pair.a.replace(/\//g, '')}-${pair.b.replace(/\//g, '')}`;
}

function chartOutline(): OutlineItem[] {
  const items: OutlineItem[] = [];
  const push = (prefix: string, sub: string) => {
    items.push({ id: `${prefix}-${sub}`, label: sub, hint: '' });
  };
  for (const g of groupBySubcategory(VOWEL_PHONEMES)) push('vowel', g.sub);
  for (const g of groupBySubcategory(CONSONANT_PHONEMES)) push('cons', g.sub);
  return items;
}

function compareOutline(): OutlineItem[] {
  return IPA_PAIRS.map((p) => ({
    id: pairId(p),
    label: p.label,
    hint: p.hint,
  }));
}

export function IpaTeaching() {
  const [tab, setTab] = useState<Tab>('overview');
  const [selected, setSelected] = useState<string | null>(null);
  const [pair, setPair] = useState<IpaPair | null>(null);
  // 记录进入详情/对比前的滚动位置，返回时恢复
  const savedScroll = useRef(0);

  const phoneme = selected ? getPhoneme(selected) : undefined;
  const a = pair ? getPhoneme(pair.a) : undefined;
  const b = pair ? getPhoneme(pair.b) : undefined;
  const inDetail = !!(phoneme || (pair && a && b));

  // 进入详情前（点击时）保存滚动位置
  const openPhoneme = (symbol: string) => {
    savedScroll.current = getScroller().scrollTop;
    setSelected(symbol);
  };
  const openPair = (p: IpaPair) => {
    savedScroll.current = getScroller().scrollTop;
    setPair(p);
  };
  const back = () => {
    setSelected(null);
    setPair(null);
  };
  const switchTab = (t: Tab) => {
    setTab(t);
    setSelected(null);
    setPair(null);
  };

  // 返回总览时恢复滚动位置（等渲染完成后）
  useEffect(() => {
    if (!inDetail) {
      requestAnimationFrame(() => {
        getScroller().scrollTop = savedScroll.current;
      });
    }
  }, [inDetail]);

  // 大纲导航点击：滚动到目标区域
  const navigateTo = (id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    const sc = getScroller();
    const top = target.getBoundingClientRect().top + sc.scrollTop - sc.getBoundingClientRect().top - 12;
    sc.scrollTo({ top, behavior: 'smooth' });
  };

  const outlineItems = tab === 'chart' ? chartOutline() : tab === 'compare' ? compareOutline() : [];

  // 易混淆对比详情页：展示最全信息 + 支持跟读
  if (pair && a && b) {
    return (
      <IpaPairDetail
        a={a}
        b={b}
        label={pair.label}
        hint={pair.hint}
        description={pair.description}
        onBack={back}
      />
    );
  }

  if (phoneme) {
    return <PhonemeDetail phoneme={phoneme} onBack={back} />;
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
            onClick={() => switchTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'overview' ? (
        <IpaOverview onShadow={openPhoneme} />
      ) : tab === 'chart' ? (
        <IpaChart onSelect={openPhoneme} />
      ) : (
        <IpaCompare onOpen={openPair} />
      )}
      <IpaReferences />
      <OutlineNav items={outlineItems} onNavigate={navigateTo} />
    </div>
  );
}
