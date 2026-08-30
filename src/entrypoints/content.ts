/**
 * 有道词典单词页注入：浮动的“跟读”面板。
 * 面板是 shadow DOM + 扩展源 iframe（inject.html），
 * 单词通过 postMessage 同步给 iframe 内的 React 组件。
 */
import { extractWordFromUrl, isEnglishWord } from '../lib/word-from-url';
import { extractYoudaoInfo, type YoudaoPageInfo } from '../lib/youdao-extract';

export default defineContentScript({
  matches: [
    '*://dict.youdao.com/*',
    '*://youdao.com/*',
    '*://www.youdao.com/*',
    '*://*.youdao.com/*',
  ],
  runAt: 'document_idle',
  main() {
    const MSG_SOURCE = 'word-shadowing-ext';
    const token =
      Math.random().toString(36).slice(2) + Date.now().toString(36);

    const svgMic =
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><path d="M12 17v4"/></svg>';
    const svgBook =
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5a2 2 0 0 1 2-2h14v18H6a2 2 0 0 0-2 2V5z"/><path d="M4 19a2 2 0 0 1 2-2h14"/></svg>';
    const svgClose =
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

    const host = document.createElement('div');
    host.id = 'word-shadowing-host';
    const root = host.attachShadow({ mode: 'open' });
    document.documentElement.appendChild(host);

    const iframeUrl = chrome.runtime.getURL(`inject.html?token=${token}`);
    root.innerHTML = `
      <style>
        :host { all: initial; }
        * { box-sizing: border-box; }
        .fab {
          position: fixed; right: 18px; bottom: 18px; z-index: 2147483000;
          width: 50px; height: 50px; border-radius: 50%;
          background: linear-gradient(135deg, #4f46e5, #6366f1);
          color: #fff; border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 6px 18px rgba(79, 70, 229, 0.45);
          font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
          transition: transform 0.15s;
        }
        .fab:hover { transform: scale(1.06); }
        .fab.recording {
          background: linear-gradient(135deg, #e5484d, #ef6a6e);
          animation: ws-pulse 1.2s infinite;
        }
        @keyframes ws-pulse {
          0%, 100% { box-shadow: 0 6px 18px rgba(229, 72, 77, 0.45); }
          50% { box-shadow: 0 6px 26px rgba(229, 72, 77, 0.8); }
        }
        .panel {
          position: fixed; right: 18px; bottom: 80px; z-index: 2147483000;
          width: 350px; max-height: min(620px, calc(100vh - 110px));
          display: none; flex-direction: column;
          background: #fff; border-radius: 14px;
          box-shadow: 0 12px 40px rgba(20, 24, 40, 0.22);
          border: 1px solid #e4e7ee; overflow: hidden;
          font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
        }
        .panel.open { display: flex; }
        .panel-header {
          display: flex; align-items: center; gap: 6px;
          padding: 9px 12px;
          background: linear-gradient(135deg, #4f46e5, #6366f1);
          color: #fff; flex-shrink: 0;
        }
        .panel-title { font-size: 13px; font-weight: 600; opacity: 0.85; }
        .panel-word {
          flex: 1; font-size: 14px; font-weight: 700;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .panel-btn {
          background: transparent; border: none; color: #fff; cursor: pointer;
          display: inline-flex; align-items: center; justify-content: center;
          width: 26px; height: 26px; border-radius: 6px; padding: 0;
        }
        .panel-btn:hover { background: rgba(255, 255, 255, 0.2); }
        .panel-body { height: 470px; flex-shrink: 0; }
        .panel-body iframe { width: 100%; height: 100%; border: none; display: block; }
        .tip {
          padding: 4px 12px 8px; font-size: 11px; color: #8b93a1;
          text-align: center; flex-shrink: 0;
        }
      </style>
      <button class="fab" title="单词跟读">${svgMic}</button>
      <div class="panel">
        <div class="panel-header">
          <span class="panel-title">跟读</span>
          <span class="panel-word">—</span>
          <button class="panel-btn" data-action="sidepanel" title="在侧边栏打开完整面板">${svgBook}</button>
          <button class="panel-btn" data-action="close" title="收起">${svgClose}</button>
        </div>
        <div class="panel-body">
          <iframe
            src="${iframeUrl}"
            title="单词跟读"
            allow="microphone; autoplay"
          ></iframe>
        </div>
        <div class="tip">录音仅保存在本地 · 标记的跟读会一直保留</div>
      </div>
    `;

    const fab = root.querySelector('.fab') as HTMLElement;
    const panel = root.querySelector('.panel') as HTMLElement;
    const wordEl = root.querySelector('.panel-word') as HTMLElement;
    const iframe = root.querySelector('iframe') as HTMLIFrameElement;

    let currentWord: string | null = extractWord();
    let currentInfo: YoudaoPageInfo = extractYoudaoInfo(document);
    let panelOpen = !!currentWord;
    if (panelOpen) panel.classList.add('open');

    const sendWord = () => {
      if (!currentWord) return;
      wordEl.textContent = currentWord;
      iframe.contentWindow?.postMessage(
        {
          source: MSG_SOURCE,
          token,
          word: currentWord,
          phoneticUs: currentInfo.phoneticUs,
          phoneticUk: currentInfo.phoneticUk,
          definitions: currentInfo.definitions,
        },
        '*',
      );
    };

    // 有道是 SPA：词条切换、释义异步渲染都会触发这里
    const sync = () => {
      const w = extractWord();
      const info = extractYoudaoInfo(document);
      if (
        w !== currentWord ||
        info.phoneticUs !== currentInfo.phoneticUs ||
        info.phoneticUk !== currentInfo.phoneticUk ||
        info.definitions.length !== currentInfo.definitions.length ||
        info.definitions.some(
          (d, i) =>
            d.pos !== currentInfo.definitions[i]?.pos ||
            d.text !== currentInfo.definitions[i]?.text,
        )
      ) {
        currentWord = w;
        currentInfo = info;
        if (w) sendWord();
        else wordEl.textContent = '—';
      }
    };

    fab.addEventListener('click', () => {
      panelOpen = !panelOpen;
      panel.classList.toggle('open', panelOpen);
      if (panelOpen) sync();
    });

    root.querySelector('[data-action="close"]')?.addEventListener('click', () => {
      panelOpen = false;
      panel.classList.remove('open');
    });

    root
      .querySelector('[data-action="sidepanel"]')
      ?.addEventListener('click', () => {
        void chrome.runtime.sendMessage({ type: 'open-sidepanel' });
      });

    // iframe 就绪后发送当前单词
    window.addEventListener('message', (e) => {
      const d = e.data;
      if (d?.source === MSG_SOURCE && d.type === 'ready' && d.token === token) {
        sendWord();
      }
    });

    setInterval(sync, 800);

    sync();
  },
});

function extractWord(): string | null {
  const fromUrl = extractWordFromUrl(location.href);
  if (fromUrl) return fromUrl;
  // DOM 兜底：有道词条页的标题/关键词
  const el = document.querySelector(
    '.keyword, .title, #title, h1, .word-head .keyword, .results-content .title',
  );
  const text = el?.textContent;
  if (text) {
    const w = text.trim().split(/\s+/)[0];
    if (isEnglishWord(w)) return w.toLowerCase();
  }
  return null;
}
