import { useState } from 'react';
import { Icon } from './Icon';
import { WordList } from './WordList';
import { WordDetail } from './WordDetail';
import { MemoryReview } from './MemoryReview';
import { IpaTeaching } from './IpaTeaching';
import { useWords } from '../hooks/useWords';
import { useSettings } from '../lib/settings';
import { addWord, clearWords, removeWord } from '../lib/words';
import { clearAllData, deleteRecordingsForWord } from '../lib/db';
import { normalizeWord } from '../lib/ids';

type Section = 'words' | 'ipa' | 'review' | 'settings';

const NAV: { key: Section; label: string; icon: 'book' | 'spark' | 'repeat' | 'more' }[] = [
  { key: 'words', label: '单词本', icon: 'book' },
  { key: 'ipa', label: '音标教学', icon: 'spark' },
  { key: 'review', label: '记忆复习', icon: 'repeat' },
  { key: 'settings', label: '设置', icon: 'more' },
];

export function StandaloneApp() {
  const { words } = useWords();
  const { settings, setSetting } = useSettings();
  const [section, setSection] = useState<Section>('words');
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const navTo = (s: Section) => {
    setSection(s);
    setSelected(null);
  };

  const openWord = async (raw: string) => {
    const id = normalizeWord(raw);
    if (!id) return;
    await addWord(id);
    setQuery('');
    setSelected(id);
  };

  const handleRemove = async (id: string) => {
    await removeWord(id);
    await deleteRecordingsForWord(id);
    if (selected === id) setSelected(null);
  };

  const handleClearAll = () => {
    const ok = window.confirm(
      '确定清空所有数据吗？将删除单词本、记忆进度和全部跟读录音，且不可恢复。',
    );
    if (!ok) return;
    void clearWords().then(() => clearAllData());
    setSelected(null);
  };

  return (
    <div className="standalone">
      <aside className="standalone-nav">
        <div className="nav-brand">
          <span className="brand-icon">
            <Icon name="spark" size={15} />
          </span>
          单词跟读
        </div>
        <nav className="nav-items">
          {NAV.map((item) => (
            <button
              type="button"
              key={item.key}
              className={`nav-item ${section === item.key ? 'active' : ''}`}
              onClick={() => navTo(item.key)}
            >
              <Icon name={item.icon} size={15} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="nav-footer">
          v0.1.0
          <br />
          数据仅保存在本地
        </div>
      </aside>

      <main className="standalone-main">
        {section === 'words' &&
          (selected ? (
            <WordDetail
              wordId={selected}
              onBack={() => setSelected(null)}
              onRemove={(id) => void handleRemove(id)}
            />
          ) : (
            <div className="section">
              <h1 className="section-title">单词本</h1>
              <form
                className="search-box standalone-search"
                onSubmit={(e) => {
                  e.preventDefault();
                  void openWord(query);
                }}
              >
                <Icon name="search" size={15} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="输入英文单词，回车加入单词本"
                  autoFocus
                />
                {query && (
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setQuery('')}
                    title="清空"
                  >
                    <Icon name="close" size={13} />
                  </button>
                )}
              </form>
              <WordList
                words={words}
                onSelect={setSelected}
                onRemove={(id) => void handleRemove(id)}
              />
            </div>
          ))}

        {section === 'ipa' && <IpaTeaching />}

        {section === 'review' && (
          <MemoryReview
            onOpenWord={(id) => {
              setSelected(id);
              setSection('words');
            }}
          />
        )}

        {section === 'settings' && (
          <div className="section">
            <h1 className="section-title">设置</h1>
            <div className="card">
              <div className="card-title">跟读</div>
              <div className="setting-row">
                <div className="setting-info">
                  <div className="setting-name">
                    消除跟读录音开头的“du”杂音
                  </div>
                  <div className="setting-desc">
                    开启后：进入录音界面时预热麦克风，点击「开始跟读」不再发出系统激活声；
                    新录音在源头不录入开头的瞬态杂音，旧录音播放时自动跳过。
                    关闭后：完全按麦克风原始声音录制和播放。
                  </div>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={settings.noDuEnabled}
                    onChange={(e) =>
                      void setSetting('noDuEnabled', e.target.checked)
                    }
                  />
                  <span className="slider" />
                </label>
              </div>
            </div>

            <div className="card">
              <div className="card-title">数据管理</div>
              <p className="muted small">
                清空后将删除单词本、记忆进度和全部跟读录音，且不可恢复。
              </p>
              <button
                type="button"
                className="danger-btn"
                onClick={handleClearAll}
              >
                <Icon name="trash" size={14} />
                清空所有数据
              </button>
            </div>

            <div className="card">
              <div className="card-title">关于</div>
              <p className="muted small">
                单词跟读 v0.1.0 · 展示标准发音、跟读录音与回放、标记常用跟读，
                并提供单词管理与间隔重复记忆。所有数据均保存在本地。
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
