import { useCallback, useEffect, useState } from 'react';
import { useWords } from './hooks/useWords';
import { addWord, removeWord } from './lib/words';
import { deleteRecordingsForWord } from './lib/db';
import { normalizeWord } from './lib/ids';
import type { PendingLookup } from './lib/types';
import { WordList } from './components/WordList';
import { WordDetail } from './components/WordDetail';
import { Icon } from './components/Icon';
import { SettingsPanel } from './components/SettingsPanel';
import { SpeedControl } from './components/SpeedControl';

const PENDING_KEY = 'pendingLookup';

interface AppProps {
  compact?: boolean;
}

export function App({ compact }: AppProps) {
  const { words, refresh } = useWords();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const openWord = useCallback(async (raw: string) => {
    const id = normalizeWord(raw);
    if (!id) return;
    await addWord(id);
    setQuery('');
    setSelected(id);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void openWord(query);
  };

  const handleRemove = async (id: string) => {
    await removeWord(id);
    await deleteRecordingsForWord(id);
    if (selected === id) setSelected(null);
    await refresh();
  };

  // 消费右键菜单/其他入口发来的待查询单词
  useEffect(() => {
    const consume = async () => {
      const v = await chrome.storage.local.get(PENDING_KEY);
      const pending = v[PENDING_KEY] as PendingLookup | undefined;
      if (!pending) return;
      await chrome.storage.local.remove(PENDING_KEY);
      void openWord(pending.word);
    };
    void consume();
    const onChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area === 'local' && PENDING_KEY in changes) void consume();
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, [openWord]);

  const openSidepanel = async () => {
    if (typeof chrome.sidePanel !== 'undefined' && chrome.sidePanel.open) {
      await chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
      window.close();
    }
  };

  return (
    <div className={`app ${compact ? 'compact' : ''}`}>
      <header className="app-header">
        <div className="brand">
          <span className="brand-icon">
            <Icon name="spark" size={15} />
          </span>
          <span className="brand-name">单词跟读</span>
          {compact && typeof chrome.sidePanel !== 'undefined' && (
            <>
              <SpeedControl />
              <button
                type="button"
                className="link-btn sidepanel-btn"
                onClick={() => void openSidepanel()}
                title="在侧边栏打开完整面板"
              >
                侧边栏
              </button>
            </>
          )}
          <div className="header-actions">
            <button
              type="button"
              className="icon-btn"
              onClick={() => chrome.runtime.openOptionsPage?.()}
              title="打开独立页面"
            >
              <Icon name="expand" size={15} />
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setSettingsOpen(true)}
              title="设置"
            >
              <Icon name="more" size={16} />
            </button>
          </div>
        </div>
        <form className="search-box" onSubmit={handleSubmit}>
          <Icon name="search" size={15} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="输入英文单词，回车加入单词本"
            autoFocus={!compact}
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
      </header>

      <main className="app-main">
        {selected ? (
          <WordDetail
            wordId={selected}
            compact={compact}
            onBack={() => setSelected(null)}
            onRemove={(id) => void handleRemove(id)}
          />
        ) : (
          <WordList
            words={words}
            onSelect={setSelected}
            onRemove={(id) => void handleRemove(id)}
          />
        )}
      </main>

      <footer className="app-footer">
        {selected ? (
          <button type="button" className="link-btn" onClick={() => setSelected(null)}>
            <Icon name="book" size={13} />
            返回单词本（{words.length}）
          </button>
        ) : (
          <span className="muted small">
            共 {words.length} 个单词 · 选中网页文字后右键可快速查询
          </span>
        )}
      </footer>
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
