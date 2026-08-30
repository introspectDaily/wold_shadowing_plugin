import { Icon } from './Icon';

interface SourceLink {
  name: string;
  url: string;
  desc: string;
}

const SOURCES: SourceLink[] = [
  {
    name: 'Oxford Learner’s Dictionaries · 发音指南',
    url: 'https://www.oxfordlearnersdictionaries.com/about/english/pronunciation_english',
    desc: '权威词典的音标符号与示例单词、英式 RP / 美式 GA 读音模型（示例单词与音标主要依据）。',
  },
  {
    name: 'Wikipedia · English phonology',
    url: 'https://en.wikipedia.org/wiki/English_phonology',
    desc: '英语音位分类：单元音/双元音、爆破/摩擦/破擦/鼻/近音，24 个辅音音位、fortis/lenis、/r/ 实为近音等说明。',
  },
  {
    name: 'Cambridge Dictionary',
    url: 'https://dictionary.cambridge.org/',
    desc: '国际通用权威词典，可查英/美发音与音标。',
  },
  {
    name: 'International Phonetic Association (IPA)',
    url: 'https://www.internationalphoneticassociation.org/',
    desc: '国际音标符号体系的标准制定方。',
  },
];

const CONVENTIONS: { title: string; text: string }[] = [
  {
    title: '长元音 / 短元音',
    text: '“长/短元音”是英语教学中的常用叫法（如 /iː/ 长、/ɪ/ 短），并非严格的声学时长概念；在音系学上，英语元音通常按“单元音 / 双元音”分类。',
  },
  {
    title: '英式 vs 美式',
    text: '本表以英式 RP 为主、兼顾美式 GA。双元音 /əʊ/ 为英式写法，美式常写作 /oʊ/；/ɒ/ 仅见于英式英语，美式多读作 /ɔː/ 或 /ɑː/。',
  },
  {
    title: '记法约定',
    text: '/e/ 在一些体系（如剑桥）写作 /ɛ/；/ʊə/ 在现代英语中趋于弱化、常并入 /ɔː/ 或 /ʊ/。本表采用词典常用的宽式音标（音位记法）。',
  },
  {
    title: '示例单词音标',
    text: '示例单词及其音标与 Oxford / 有道等词典标注一致；跟读标准发音来自有道 dictvoice（美/英），可点击试听。',
  },
];

export function IpaReferences() {
  return (
    <div className="ipa-refs">
      <section className="card">
        <div className="card-title">
          <Icon name="book" size={13} />
          权威参考来源
        </div>
        <ul className="ipa-ref-list">
          {SOURCES.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.name}
              </a>
              <p className="muted small">{s.desc}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <div className="card-title">
          <Icon name="spark" size={13} />
          标注约定说明
        </div>
        <ul className="ipa-conv-list">
          {CONVENTIONS.map((c) => (
            <li key={c.title}>
              <b>{c.title}</b>
              <p className="muted small">{c.text}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
