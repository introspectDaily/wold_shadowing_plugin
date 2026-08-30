import type { Phoneme } from '../lib/ipa-data';
import { PhonemeBody } from './PhonemeBody';
import { Icon } from './Icon';

interface PhonemeDetailProps {
  phoneme: Phoneme;
  onBack: () => void;
}

export function PhonemeDetail({ phoneme, onBack }: PhonemeDetailProps) {
  return (
    <div className="ipa-detail">
      <header className="ipa-detail-header">
        <button type="button" className="icon-btn" onClick={onBack} title="返回">
          <Icon name="back" size={16} />
        </button>
        <span className="ipa-detail-title">音标详情</span>
      </header>

      <section className="card">
        <PhonemeBody phoneme={phoneme} />
      </section>
    </div>
  );
}
