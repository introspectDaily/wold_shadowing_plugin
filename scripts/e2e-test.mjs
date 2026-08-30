// End-to-end smoke test: launches Chrome with the built extension and drives
// the popup UI over CDP (no external deps, uses Node's built-in WebSocket).
// Requires: pnpm build first, and a mic is faked via Chrome flags.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXT_DIR = join(root, 'dist', 'chrome-mv3');
const PORT = 9333;
const CHROME =
  process.env.CHROME_BIN ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT_DIR = process.env.SHOT_DIR || join(tmpdir(), 'ws-e2e-shots');

if (!existsSync(EXT_DIR)) {
  console.error('dist/chrome-mv3 not found. Run `pnpm build` first.');
  process.exit(1);
}

let pass = 0;
let fail = 0;
function step(name, ok, extra = '') {
  if (ok) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.error(`  ✗ ${name} ${extra}`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, { timeout = 20000, interval = 250 } = {}) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeout) {
    try {
      last = await fn();
      if (last) return last;
    } catch {
      /* retry */
    }
    await sleep(interval);
  }
  throw new Error(`waitFor timeout; last=${JSON.stringify(last)}`);
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      let id = 0;
      const pending = new Map();
      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.id && pending.has(msg.id)) {
          pending.get(msg.id)(msg);
          pending.delete(msg.id);
        }
      };
      const send = (method, params = {}) =>
        new Promise((res) => {
          const mid = ++id;
          pending.set(mid, res);
          ws.send(JSON.stringify({ id: mid, method, params }));
        });
      resolve({ send, ws });
    };
    ws.onerror = (e) => reject(new Error(`ws error: ${e.message ?? e}`));
  });
}

async function getTargets() {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  return res.json();
}

async function main() {
  const userDataDir = mkdtempSync(join(tmpdir(), 'ws-e2e-'));
  console.log('user-data-dir:', userDataDir);
  console.log('extension:', EXT_DIR);

  const args = [
    `--user-data-dir=${userDataDir}`,
    `--remote-debugging-port=${PORT}`,
    `--load-extension=${EXT_DIR}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions-except=' + EXT_DIR,
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    '--disable-gpu',
    'about:blank',
  ];
  if (process.env.HEADLESS !== '0') args.splice(args.length - 1, 0, '--headless=new');
  const chrome = spawn(CHROME, args, { stdio: 'ignore' });
  const kill = () => chrome.kill('SIGKILL');
  process.on('exit', kill);
  process.on('SIGINT', () => {
    kill();
    process.exit(130);
  });

  let extensionId;
  try {
    await waitFor(async () => {
      const targets = await getTargets();
      const sw = targets.find(
        (t) => t.type === 'service_worker' && t.url.startsWith('chrome-extension://'),
      );
      if (sw) {
        extensionId = new URL(sw.url).host;
        return extensionId;
      }
      return null;
    });
    console.log('extension id:', extensionId);

    // Ask the extension's own background worker to open the popup page
    // (navigating a normal tab to chrome-extension:// URLs is blocked).
    const targets0 = await getTargets();
    const swTarget = targets0.find(
      (t) => t.type === 'service_worker' && t.url.includes(extensionId),
    );
    const sw = await connect(swTarget.webSocketDebuggerUrl);
    await sw.send('Runtime.enable');
    const opened = await sw.send('Runtime.evaluate', {
      expression: `chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') }).then(t => t.id)`,
      awaitPromise: true,
      returnByValue: true,
    });
    if (opened.result?.exceptionDetails) {
      throw new Error('tabs.create failed: ' + JSON.stringify(opened.result));
    }
    console.log('opened popup tab:', opened.result?.result?.value);

    const popupTarget = await waitFor(async () => {
      const targets = await getTargets();
      return (
        targets.find(
          (t) =>
            t.type === 'page' &&
            t.url === `chrome-extension://${extensionId}/popup.html`,
        ) ?? null
      );
    });
    const cdp = await connect(popupTarget.webSocketDebuggerUrl);
    const { send } = cdp;
    await send('Page.enable');
    await send('Runtime.enable');

    const evalJs = async (expression) => {
      const r = await send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      if (r.result?.exceptionDetails) {
        throw new Error(
          'page exception: ' +
            JSON.stringify(r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails),
        );
      }
      return r.result?.result?.value;
    };

    const shot = async (name) => {
      const r = await send('Page.captureScreenshot', { format: 'png' });
      if (r.result?.data) {
        writeFileSync(join(OUT_DIR, name + '.png'), Buffer.from(r.result.data, 'base64'));
        console.log('  📸 saved', join(OUT_DIR, name + '.png'));
      }
    };

    try {
      await waitFor(() => evalJs(`!!document.querySelector('.search-box input')`));
    } catch (e) {
      const diag = await evalJs(
        `JSON.stringify({
          url: location.href,
          title: document.title,
          body: document.body?.innerHTML?.slice(0, 300),
          rootChildren: document.getElementById('root')?.children.length ?? -1
        })`,
      );
      console.error('popup not ready, diag=', diag);
      throw e;
    }

    // 1. 输入并添加单词
    await evalJs(`(() => {
      const input = document.querySelector('.search-box input');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, 'abandon');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await evalJs(`document.querySelector('.search-box form')?.requestSubmit?.(); true`);
    await waitFor(() =>
      evalJs(`document.querySelector('.word-title')?.textContent?.toLowerCase() === 'abandon'`),
    );
    step('输入 abandon 后进入单词详情', true);

    // 2. 释义加载
    await waitFor(
      () => evalJs(`document.querySelectorAll('.meaning').length > 0`),
      { timeout: 30000 },
    );
    const meaningText = await evalJs(
      `document.querySelector('.meaning li span')?.textContent?.slice(0, 80)`,
    );
    step('释义加载成功', !!meaningText, `text=${meaningText}`);
    await shot('01-word-detail');

    // 3. 标准发音按钮存在
    const accents = await evalJs(
      `[...document.querySelectorAll('.accent-btn')].map(b => b.title)`,
    );
    step(
      '标准发音 US/UK 按钮存在',
      accents.includes('美式发音') && accents.includes('英式发音'),
      JSON.stringify(accents),
    );

    // 4. 录 4 遍跟读
    for (let i = 0; i < 4; i++) {
      await evalJs(`document.querySelector('.record-btn')?.click(); true`);
      await waitFor(() => evalJs(`!!document.querySelector('.record-btn.stop')`));
      await sleep(1200);
      await evalJs(`document.querySelector('.record-btn.stop')?.click(); true`);
      await waitFor(
        () =>
          evalJs(
            `document.querySelectorAll('.recording-item').length === ${i + 1}`,
          ),
        { timeout: 15000 },
      );
    }
    step('录下 4 条跟读', true);
    await shot('02-four-recordings');

    // 5. 默认只显示最新 3 条（含标记的会一直显示）
    const visibleCount = await evalJs(
      `document.querySelectorAll('.recording-item').length`,
    );
    const hasShowAll = await evalJs(
      `[...document.querySelectorAll('button')].some(b => b.textContent.includes('查看全部'))`,
    );
    step(
      '默认显示最新 3 条跟读',
      visibleCount === 3 && hasShowAll,
      `visible=${visibleCount}`,
    );

    // 6. 播放第一条（最新）录音
    await evalJs(`document.querySelector('.recording-item .play-round')?.click(); true`);
    await sleep(400);
    const playing = await evalJs(
      `!!document.querySelector('.recording-item.playing')`,
    );
    step('播放我的跟读（进入播放态）', playing);
    await sleep(700);

    // 7. 标记（pin）最新一条
    await evalJs(
      `document.querySelector('.recording-item .recording-actions .icon-btn:not(.danger)')?.click(); true`,
    );
    await waitFor(() =>
      evalJs(`!!document.querySelector('.recording-item .pinned-tag')`),
    );
    step('标记跟读成功（出现“已标记”标签）', true);
    await shot('03-pinned');

    // 8. 查看全部 → 显示 4 条
    await evalJs(
      `[...document.querySelectorAll('button')].find(b => b.textContent.includes('查看全部'))?.click(); true`,
    );
    await waitFor(
      () => evalJs(`document.querySelectorAll('.recording-item').length === 4`),
    );
    step('“查看全部”显示 4 条', true);

    // 9. 删除一条非标记录音
    const before = await evalJs(`document.querySelectorAll('.recording-item').length`);
    await evalJs(
      `(() => {
        const items = [...document.querySelectorAll('.recording-item')];
        const target = items.find(it => !it.querySelector('.pinned-tag')) ?? items[items.length-1];
        target.querySelector('.recording-actions .danger')?.click();
      })(); true`,
    );
    await waitFor(
      () =>
        evalJs(
          `document.querySelectorAll('.recording-item').length === ${before - 1}`,
        ),
    );
    step('删除一条跟读成功', true);

    // 10. 记忆：点击“记得”
    await evalJs(
      `[...document.querySelectorAll('.review-btn')].find(b => b.textContent === '记得')?.click(); true`,
    );
    await waitFor(() =>
      evalJs(`document.querySelector('.status-badge')?.textContent === '已复习'`),
    );
    const reviewInfo = await evalJs(
      `document.querySelector('.memory-status')?.textContent?.trim()`,
    );
    step('点击“记得”后状态变为已复习', true, `info=${reviewInfo}`);
    await shot('04-reviewed');

    // 11. 刷新页面 → 持久化验证（单词、标记的录音、记忆状态仍在）
    await send('Page.reload');
    await waitFor(() => evalJs(`!!document.querySelector('.search-box input')`));
    // 重新进入该单词
    await evalJs(`(() => {
      const input = document.querySelector('.search-box input');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, 'abandon');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await evalJs(`document.querySelector('.search-box form')?.requestSubmit?.(); true`);
    await waitFor(() =>
      evalJs(`document.querySelector('.word-title')?.textContent?.toLowerCase() === 'abandon'`),
    );
    const afterReload = {
      pinned: await evalJs(`document.querySelectorAll('.pinned-tag').length`),
      status: await evalJs(`document.querySelector('.status-badge')?.textContent`),
      recordings: await evalJs(`document.querySelectorAll('.recording-item').length`),
    };
    step(
      '刷新后标记与记忆状态持久化',
      afterReload.pinned >= 1 && afterReload.status === '已复习' && afterReload.recordings > 0,
      JSON.stringify(afterReload),
    );
    await shot('05-after-reload');

    console.log(`\n结果: ${pass} passed, ${fail} failed`);
  } finally {
    kill();
  }
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('E2E failed:', e);
  process.exit(1);
});
