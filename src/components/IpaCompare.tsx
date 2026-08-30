import { IPA_PAIRS, getPhoneme, type IpaPair } from '../lib/ipa-data';
import { PhonemeBody } from './PhonemeBody';
import { Icon } from './Icon';

interface IpaCompareProps {
  onOpen: (pair: IpaPair) => void;
}

export function IpaCompare({ onOpen }: IpaCompareProps) {
  return (
    <div className="ipa-compare">
      <p className="ipa-intro">
        易混淆音标对比总览。每一行并排展示左右两个音标的完整信息（音标、发音要点、示例单词及单词音标），
        可先听标准发音。点击「进入跟读」可对每个单词进行跟读录音与回放。
      </p>
      <div className="ipa-pair-list">
        {IPA_PAIRS.map((pair) => {
          const a = getPhoneme(pair.a);
          const b = getPhoneme(pair.b);
          if (!a || !b) return null;
          return (
            <section className="card ipa-pair" key={pair.a + pair.b}>
              <div className="ipa-pair-head">
                <span className="ipa-pair-label">
                  {pair.label}
                  <span className="ipa-pair-hint">{pair.hint}</span>
                </span>
                <button
                  type="button"
                  className="enter-btn"
                  onClick={() => onOpen(pair)}
                  title="进入跟读练习"
                >
                  <Icon name="mic" size={13} />
                  进入跟读
                </button>
              </div>
              <p className="ipa-pair-desc">
                <Icon name="spark" size={11} />
                {pair.description}
              </p>
              <div className="ipa-compare-table">
                <div className="ipa-compare-col">
                  <PhonemeBody phoneme={a} compact />
                </div>
                <div className="ipa-compare-col">
                  <PhonemeBody phoneme={b} compact />
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
