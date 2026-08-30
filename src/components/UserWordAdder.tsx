import { useState } from 'react';
import { useIpaUserWords, getWordPhonetic } from '../lib/ipaUserWords';
import { Icon } from './Icon';

interface UserWordAdderProps {
  symbol: string;
}

/** 在某个音标下新增用户单词（自动获取音标） */
export function UserWordAdder({ symbol }: UserWordAdderProps) {
  const { add } = useIpaUserWords();
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const w = word.trim().toLowerCase();
    if (!w) return;
    setBusy(true);
    try {
      const phonetic = await getWordPhonetic(w);
      await add(symbol, w, phonetic);
      setWord('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="user-word-adder"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Icon name="plus" size={13} />
      <input
        value={word}
        onChange={(e) => setWord(e.target.value)}
        placeholder="输入单词，回车添加到该音标"
        disabled={busy}
      />
      <button type="submit" className="accent-btn" disabled={busy || !word.trim()}>
        {busy ? '查询中…' : '添加'}
      </button>
    </form>
  );
}
