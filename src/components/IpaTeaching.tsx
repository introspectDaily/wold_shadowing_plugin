import { useEffect, useRef, useState } from 'react';
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

/** 找到实际滚动的容器（独立页为 .standalone-main） */
function getScroller(): HTMLElement {
  const el = document.querySelector<HTMLElement>('.standalone-main');
  return el ?? (document.scrollingElement as HTMLElement);
}

export function IpaTeaching() {
  const [tab, setTab] = useState<Tab>('chart');
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
      {tab === 'chart' ? (
        <IpaChart onSelect={openPhoneme} />
      ) : (
        <IpaCompare onOpen={openPair} />
      )}
      <IpaReferences />
    </div>
  );
}
