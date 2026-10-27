// 画布页面的视觉自查：启动 Chrome + 加载扩展 → 打开 canvas.html →
// 建笔记 / 输入中文 / 刷新验证持久化 → 逐步截图。
// 用法：pnpm build && node scripts/canvas-shot.mjs
import { spawn } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  realpathSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir, tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXT_DIR = join(root, 'dist', 'chrome-mv3');
const PORT = 9444;
/**
 * Chrome 137+ 的官方版本已经移除了 `--load-extension`
 * （见 chromium-extensions 公告），用它跑本脚本扩展根本不会加载。
 * 所以这里优先用 Chrome for Testing / Chromium（不受该限制）。
 */
function resolveChrome() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  const home = homedir();
  const candidates = [];
  const pwCache = join(home, 'Library/Caches/ms-playwright');
  if (existsSync(pwCache)) {
    for (const dir of readdirSync(pwCache).filter((d) => d.startsWith('chromium-'))) {
      candidates.push(
        join(
          pwCache,
          dir,
          'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
        ),
        join(
          pwCache,
          dir,
          'chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
        ),
      );
    }
  }
  candidates.push(
    '/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  );
  for (const c of candidates) if (existsSync(c)) return c;
  return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
}
const CHROME = resolveChrome();
const OUT_DIR = process.env.SHOT_DIR || join(root, 'dev', 'canvas-shots');

if (!existsSync(EXT_DIR)) {
  console.error('dist/chrome-mv3 not found. Run `pnpm build` first.');
  process.exit(1);
}
mkdirSync(OUT_DIR, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, { timeout = 25000, interval = 200 } = {}) {
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

function connect(wsUrl, onEvent) {
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
        } else if (onEvent) {
          onEvent(msg);
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

const getTargets = () => fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
const getVersion = () => fetch(`http://127.0.0.1:${PORT}/json/version`).then((r) => r.json());

let pass = 0;
let fail = 0;
function check(name, ok, extra = '') {
  if (ok) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.error(`  ✗ ${name} ${extra}`);
  }
}

async function shot(page, name) {
  const { result } = await page.send('Page.captureScreenshot', { format: 'png' });
  const file = join(OUT_DIR, `${name}.png`);
  writeFileSync(file, Buffer.from(result.data, 'base64'));
  console.log(`  📸 ${file}`);
}

async function evaluate(page, expression, awaitPromise = true) {
  const r = await page.send('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true,
  });
  if (r.result?.exceptionDetails) {
    throw new Error(
      `evaluate failed: ${r.result.exceptionDetails.exception?.description ?? JSON.stringify(r.result.exceptionDetails)}`,
    );
  }
  return r.result?.result?.value;
}

async function main() {
  console.log('chrome:', CHROME);
  const userDataDir = mkdtempSync(join(tmpdir(), 'canvas-shot-'));
  const args = [
    `--user-data-dir=${userDataDir}`,
    `--remote-debugging-port=${PORT}`,
    `--load-extension=${EXT_DIR}`,
    `--disable-extensions-except=${EXT_DIR}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1440,900',
    '--headless=new',
    'about:blank',
  ];
  const chrome = spawn(CHROME, args, { stdio: 'ignore' });
  const kill = () => chrome.kill('SIGKILL');
  process.on('exit', kill);

  try {
    // 未打包扩展的 ID = sha256(绝对路径) 前 32 位 hex，逐位 0-f → a-p
    const hex = createHash('sha256').update(realpathSync(EXT_DIR)).digest('hex').slice(0, 32);
    const extensionId = [...hex]
      .map((c) => String.fromCharCode(97 + parseInt(c, 16)))
      .join('');
    console.log('extension id:', extensionId);

    // 普通标签页不允许直接跳到 chrome-extension://（ERR_BLOCKED_BY_CLIENT），
    // 必须走浏览器级别的 Target.createTarget 才能开扩展页面。
    const version = await waitFor(getVersion);
    const browser = await connect(version.webSocketDebuggerUrl);
    const created = await browser.send('Target.createTarget', {
      url: `chrome-extension://${extensionId}/canvas.html`,
    });
    const targetId = created.result?.targetId;
    if (!targetId) throw new Error('Target.createTarget 失败：' + JSON.stringify(created));

    const pageTarget = await waitFor(async () => {
      const list = await getTargets();
      return list.find((t) => t.id === targetId && t.type === 'page');
    });

    const logs = [];
    const page = await connect(pageTarget.webSocketDebuggerUrl, (msg) => {
      if (msg.method === 'Runtime.consoleAPICalled') {
        logs.push(
          `[${msg.params.type}] ` +
            msg.params.args.map((a) => a.value ?? a.description).join(' '),
        );
      } else if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails;
        logs.push('[exception] ' + (d.exception?.description ?? d.text));
      }
    });
    await page.send('Page.enable');
    await page.send('Runtime.enable');

    const mounted = () =>
      evaluate(page, `!!document.querySelector('.cv-app')`, false).then(Boolean);
    try {
      await waitFor(mounted);
    } catch (err) {
      const info = await evaluate(
        page,
        `JSON.stringify({ url: location.href, text: document.body ? document.body.innerText.slice(0, 300) : '' })`,
        false,
      );
      console.error('\n--- 页面状态 ---\n' + info);
      console.error('\n--- console / exception ---\n' + (logs.join('\n') || '(无)'));
      throw err;
    }
    await sleep(500);
    const layout = await evaluate(
      page,
      `JSON.stringify((() => {
        const q = (s) => { const e = document.querySelector(s); if (!e) return null;
          const r = e.getBoundingClientRect();
          return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) }; };
        return {
          innerH: innerHeight, scrollH: document.documentElement.scrollHeight,
          bodyH: Math.round(document.body.getBoundingClientRect().height),
          flow: q('.cv-flow'), rf: q('.react-flow'),
          controls: q('.react-flow__controls'), minimap: q('.react-flow__minimap'),
        };
      })())`,
      false,
    );
    console.log('  layout:', layout);
    console.log('\n1) 首次打开');
    await shot(page, '01-empty');

    const ui = await evaluate(
      page,
      `(() => ({
        sidebar: !!document.querySelector('.cv-sidebar'),
        tabs: [...document.querySelectorAll('.cv-tab-title')].map(e => e.textContent),
        pages: [...document.querySelectorAll('.cv-page-title')].map(e => e.textContent),
        flow: !!document.querySelector('.react-flow'),
      }))()`,
      false,
    );
    console.log('  ui:', JSON.stringify(ui));
    check('左栏存在', ui.sidebar);
    check('分区标签存在', ui.tabs.length > 0);
    check('页面列表存在', ui.pages.length > 0);
    check('画布已挂载', ui.flow);

    console.log('\n2) 新建笔记 + 输入中文');
    await evaluate(
      page,
      `[...document.querySelectorAll('.cv-btn')].find(b => b.textContent.includes('笔记')).click()`,
      false,
    );
    await sleep(600);
    await page.send('Input.insertText', {
      text: '会议要点\n1. 无限画布要能一键展开\n2. PDF 裁切走版面分析',
    });
    await sleep(300);
    await shot(page, '02-typing');

    await evaluate(
      page,
      `document.activeElement && document.activeElement.blur()`,
      false,
    );
    await sleep(600);

    console.log('\n3) 加标题 / 待办');
    for (const label of ['标题', '待办']) {
      await evaluate(
        page,
        `[...document.querySelectorAll('.cv-btn')].find(b => b.textContent.trim() === ${JSON.stringify(label)}).click()`,
        false,
      );
      await sleep(400);
      await page.send('Input.insertText', {
        text: label === '标题' ? '第三章 · 版面分析' : '整理裁切结果',
      });
      await sleep(250);
      await evaluate(page, `document.activeElement && document.activeElement.blur()`, false);
      await sleep(400);
    }
    await shot(page, '03-three-nodes');

    const counts = await evaluate(
      page,
      `(() => ({
        nodes: document.querySelectorAll('.cv-node').length,
        hasTodoBox: !!document.querySelector('.cv-todo-box'),
        texts: [...document.querySelectorAll('.cv-node-text')].map(e => e.textContent),
      }))()`,
      false,
    );
    console.log('  nodes:', JSON.stringify(counts));
    check('创建了 3 个节点', counts.nodes === 3, `实际 ${counts.nodes}`);
    check('待办有复选框', counts.hasTodoBox);
    check('中文内容正确落位', (counts.texts || []).some((t) => t.includes('无限画布')));

    console.log('\n4) 选中 → 删除 → 撤销');
    const rect = await evaluate(
      page,
      `(() => { const n = document.querySelector('.cv-node'); const r = n.getBoundingClientRect();
        return { x: Math.round(r.left + 40), y: Math.round(r.top + 24) }; })()`,
      false,
    );
    await page.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: rect.x,
      y: rect.y,
      button: 'left',
      clickCount: 1,
    });
    await page.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: rect.x,
      y: rect.y,
      button: 'left',
      clickCount: 1,
    });
    await sleep(400);
    const selCount = await evaluate(page, `document.querySelectorAll('.cv-node.is-selected').length`, false);
    check('单击可以选中节点', selCount === 1, `实际 ${selCount}`);

    const key = (k, code, vk, modifiers = 0) =>
      page.send('Input.dispatchKeyEvent', {
        type: 'keyDown',
        key: k,
        code,
        windowsVirtualKeyCode: vk,
        nativeVirtualKeyCode: vk,
        modifiers,
      });
    await key('Delete', 'Delete', 46);
    await sleep(400);
    const afterDel = await evaluate(page, `document.querySelectorAll('.cv-node').length`, false);
    check('Delete 删掉选中节点', afterDel === 2, `实际 ${afterDel}`);

    // Ctrl+Z 撤销
    await key('z', 'KeyZ', 90, 2);
    await sleep(500);
    const afterUndo = await evaluate(page, `document.querySelectorAll('.cv-node').length`, false);
    check('Ctrl+Z 撤销恢复节点', afterUndo === 3, `实际 ${afterUndo}`);

    console.log('\n5) 刷新页面验证持久化');
    await sleep(900);
    await page.send('Page.reload');
    await sleep(1500);
    await waitFor(mounted);
    await sleep(600);
    const after = await evaluate(
      page,
      `(() => ({
        nodes: document.querySelectorAll('.cv-node').length,
        text: [...document.querySelectorAll('.cv-node-text')].map(e => e.textContent).join(' | '),
      }))()`,
      false,
    );
    console.log('  after reload:', JSON.stringify(after));
    check('刷新后节点还在', after.nodes === 3, `实际 ${after.nodes}`);
    check('刷新后中文没丢', (after.text || '').includes('无限画布'));
    await shot(page, '04-after-reload');

    console.log('\n6) 双击空白处新建笔记');
    await evaluate(
      page,
      `document.querySelector('.react-flow__pane').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`,
      false,
    );
    await sleep(600);
    await page.send('Input.insertText', { text: '双击空白新建的笔记' });
    await sleep(250);
    await evaluate(page, `document.activeElement && document.activeElement.blur()`, false);
    await sleep(400);
    const afterDbl = await evaluate(
      page,
      `(() => ({ n: document.querySelectorAll('.cv-node').length,
                 t: [...document.querySelectorAll('.cv-node-text')].map(e => e.textContent).join('|') }))()`,
      false,
    );
    check('双击空白新建了笔记', afterDbl.n === 4, `实际 ${afterDbl.n}`);
    check('双击新建的内容正确', (afterDbl.t || '').includes('双击空白新建的笔记'));
    await shot(page, '05-dblclick');

    if (logs.length) {
      console.log('\n--- console ---\n' + logs.join('\n'));
    }
    console.log(`\n结果：${pass} 通过 / ${fail} 失败 → ${OUT_DIR}`);
  } finally {
    kill();
  }
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
