import { useEffect, useState } from 'react';
import { lookupWord } from '../lib/dict';

interface WordPhoneticsProps {
  word: string;
  /** 本地数据自带的音标（英式 RP 为主），作为联网失败时的兜底 */
  fallback?: string;
  /** 是否联网获取权威的英/美音标并分别标注（详情/跟读页用；总览页关闭避免大量请求） */
  fetch?: boolean;
}

/**
 * 展示单词音标。fetch 开启时从词典权威获取英式/美式并分别标注（缓存），
 * 失败或未开启时回退到本地音标。
 */
export function WordPhonetics({ word, fallback, fetch }: WordPhoneticsProps) {
  const [uk, setUk] = useState<string>();
  const [us, setUs] = useState<string>();

  useEffect(() => {
    if (!fetch) return;
    let on = true;
    void lookupWord(word).then((res) => {
      if (!on) return;
      if (res.info?.phoneticUk) setUk(`/${res.info.phoneticUk}/`);
      if (res.info?.phoneticUs) setUs(`/${res.info.phoneticUs}/`);
    });
    return () => {
      on = false;
    };
  }, [word, fetch]);

  if (uk || us) {
    return (
      <span className="phonetics">
        {uk && (
          <span className="phonetic">
            <i className="accent-label">英</i>
            {uk}
          </span>
        )}
        {us && (
          <span className="phonetic">
            <i className="accent-label">美</i>
            {us}
          </span>
        )}
      </span>
    );
  }
  return <span className="phonetic">{fallback ?? ''}</span>;
}
