import { useEffect, useRef, useState } from 'react';
import { PronounceBar } from './PronounceBar';
import { RecorderWidget } from './RecorderWidget';
import { RecordingList } from './RecordingList';
import { useRecordings } from '../hooks/useRecordings';
import { addWord } from '../lib/words';
import { deleteRecording, saveRecording, setRecordingPinned } from '../lib/db';
import { normalizeWord, uid } from '../lib/ids';
import { SettingsPanel } from './SettingsPanel';
import { Icon } from './Icon';
import { releaseMic, warmUpMic } from '../lib/mic';

const MSG_SOURCE = 'word-shadowing-ext';

interface PageDict {
  phoneticUs?: string;
  phoneticUk?: string;
  definitions?: { pos?: string; text: string }[];
}

/**
 * 嵌入在有道单词页 iframe 里的紧凑跟读面板。
 * 单词由父页面（content script）通过 postMessage 传入。
 */
export function ShadowingWidget() {
  const [word, setWord] = useState('');
  const [pageDict, setPageDict] = useState<PageDict | undefined>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const tokenRef = useRef('');
  const recordings = useRecordings(word);

  useEffect(() => {
    const token = new URLSearchParams(location.search).get('token') ?? '';
    tokenRef.current = token;

    const onMessage = (e: MessageEvent) => {
      const d = e.data;
      if (
        d?.source !== MSG_SOURCE ||
        (token && d.token !== token) ||
        typeof d.word !== 'string'
      ) {
        return;
      }
      const w = normalizeWord(d.word);
      if (w) {
        setWord(w);
        setPageDict({
          phoneticUs: d.phoneticUs,
          phoneticUk: d.phoneticUk,
          definitions: d.definitions,
        });
      }
    };
    window.addEventListener('message', onMessage);
    // 通知父页面 iframe 已就绪，可以开始发送单词
    window.parent.postMessage(
      { source: MSG_SOURCE, type: 'ready', token },
      '*',
    );
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // 面板识别到单词后预热麦克风，让“du”发生在面板打开时而不是点击录音时
  useEffect(() => {
    if (word) {
      warmUpMic();
      return () => releaseMic();
    }
  }, [word]);

  // 在有道页面上跟读过的单词，自动加入单词本（幂等）
  useEffect(() => {
    if (word) void addWord(word);
  }, [word]);

  const handleSave = async (blob: Blob, durationMs: number) => {
    if (!word) return;
    await saveRecording({
      id: uid('rec-'),
      word,
      createdAt: Date.now(),
      durationMs,
      blob,
    });
  };

  const handleTogglePin = async (id: string, pinned: boolean) => {
    await setRecordingPinned(id, pinned);
  };

  const handleDelete = async (id: string) => {
    await deleteRecording(id);
  };

  if (!word) {
    return (
      <div className="widget">
        <div className="widget-placeholder">
          <p>打开一个有道单词页面，即可在这里跟读录音。</p>
          <p className="muted small">（当前页面未识别到单词）</p>
        </div>
      </div>
    );
  }

  return (
    <div className="widget">
      <div className="widget-word">
        <span className="widget-word-text">{word}</span>
        <button
          type="button"
          className="icon-btn widget-settings-btn"
          onClick={() => setSettingsOpen(true)}
          title="设置"
        >
          <Icon name="more" size={15} />
        </button>
      </div>
      <PronounceBar
        word={word}
        phoneticUs={pageDict?.phoneticUs}
        phoneticUk={pageDict?.phoneticUk}
      />
      {pageDict?.definitions && pageDict.definitions.length > 0 && (
        <div className="card dict-card">
          <div className="card-title">
            释义
            <span className="muted small">来自有道页面</span>
          </div>
          <div className="meanings">
            {pageDict.definitions.map((d, i) => (
              <div className="meaning" key={i}>
                {d.pos && <span className="pos">{d.pos}</span>}
                <ul>
                  <li>
                    <span>{d.text}</span>
                  </li>
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
      <RecorderWidget onSave={handleSave} />
      <RecordingList
        word={word}
        metas={recordings.metas}
        loading={recordings.loading}
        loadRecording={async (id) => (await recordings.loadRecording(id))?.blob}
        onTogglePin={handleTogglePin}
        onDelete={handleDelete}
      />
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
