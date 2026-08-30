import { useAudio } from '../lib/useAudio';
import { useRecordings } from '../hooks/useRecordings';
import { playCachedAudio } from '../lib/audioCache';
import { youdaoAudioUrl, speakWithBrowser } from '../lib/dict';
import { saveRecording, setRecordingPinned, deleteRecording } from '../lib/db';
import { uid } from '../lib/ids';
import { RecorderWidget } from './RecorderWidget';
import { RecordingList } from './RecordingList';
import { Icon } from './Icon';

interface WordShadowCardProps {
  word: string;
  phonetic: string;
}

/** 单个单词的跟读卡片：标准发音 + 录音 + 回放跟读 */
export function WordShadowCard({ word, phonetic }: WordShadowCardProps) {
  const audio = useAudio();
  const recordings = useRecordings(word);

  const onPlayWord = (accent: 'us' | 'uk') => {
    const key = `${accent}-${word}`;
    void playCachedAudio(audio, key, youdaoAudioUrl(word, accent), () =>
      speakWithBrowser(word, accent),
    );
  };

  const handleSave = async (blob: Blob, durationMs: number) => {
    await saveRecording({
      id: uid('rec-'),
      word,
      createdAt: Date.now(),
      durationMs,
      blob,
    });
  };

  return (
    <div className="word-shadow-card">
      <div className="ws-head">
        <div className="ws-title">
          <span className="ws-word">{word}</span>
          <span className="ws-phonetic">{phonetic}</span>
        </div>
        <div className="ws-pronounce">
          <button
            type="button"
            className="accent-btn"
            onClick={() => onPlayWord('us')}
            title="美式发音"
          >
            <Icon name="volume" size={13} />
            美
          </button>
          <button
            type="button"
            className="accent-btn"
            onClick={() => onPlayWord('uk')}
            title="英式发音"
          >
            <Icon name="volume" size={13} />
            英
          </button>
        </div>
      </div>
      <RecorderWidget onSave={handleSave} />
      <RecordingList
        word={word}
        metas={recordings.metas}
        loading={recordings.loading}
        loadRecording={async (id) => (await recordings.loadRecording(id))?.blob}
        onTogglePin={(id, pinned) => void setRecordingPinned(id, pinned)}
        onDelete={(id) => void deleteRecording(id)}
      />
    </div>
  );
}
