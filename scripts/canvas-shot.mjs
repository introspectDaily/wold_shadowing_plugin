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

    // 6) 富文本
    console.log('\n6) 富文本加粗');
    const firstNode = await evaluate(
      page,
      `(() => { const n = document.querySelector('.cv-node--note'); const r = n.getBoundingClientRect();
        return { x: Math.round(r.left + 60), y: Math.round(r.top + 30) }; })()`,
      false,
    );
    const dbl = async (x, y) => {
      for (const clickCount of [1, 2]) {
        await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount });
        await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount });
      }
    };
    await dbl(firstNode.x, firstNode.y);
    await sleep(600);
    const hasEditor = await evaluate(page, `!!document.querySelector('.cv-rt')`, false);
    check('双击进入富文本编辑', hasEditor);

    // 全选正文，然后用「真实」鼠标点加粗（合成事件会让 React Flow 的拖拽处理器拿到 null view）
    await evaluate(
      page,
      `(() => { const ed = document.querySelector('.cv-rt'); ed.focus(); document.execCommand('selectAll'); return true; })()`,
      false,
    );
    const boldRect = await evaluate(
      page,
      `(() => { const b = [...document.querySelectorAll('.cv-fmt-btn')].find(x => x.title === '加粗');
        if (!b) return null; const r = b.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`,
      false,
    );
    if (boldRect) await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: boldRect.x, y: boldRect.y, button: 'left', clickCount: 1 });
    if (boldRect) await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: boldRect.x, y: boldRect.y, button: 'left', clickCount: 1 });
    await sleep(400);
    const diag = await evaluate(
      page,
      `(() => ({ rt: !!document.querySelector('.cv-rt'), fmt: !!document.querySelector('.cv-fmtbar'),
        active: document.activeElement ? document.activeElement.className : null,
        sel: !!document.querySelector('.cv-node.is-selected') }))()`,
      false,
    );
    console.log('  diag:', JSON.stringify(diag));
    const htmlNow = await evaluate(
      page,
      `(() => { const el = document.querySelector('.cv-rt'); return el ? el.innerHTML : ''; })()`,
      false,
    );
    console.log('  editor html:', String(htmlNow).slice(0, 120));
    check('格式工具条存在', boldRect !== null);
    check('加粗生效', /<b>|font-weight:\s*bold|<strong>/i.test(htmlNow || ''), String(htmlNow).slice(0, 80));
    await shot(page, '06-richtext');
    await evaluate(page, `document.activeElement && document.activeElement.blur()`, false);
    await sleep(500);
    const storedBold = await evaluate(
      page,
      `document.querySelector('.cv-node--note .cv-node-text').innerHTML`,
      false,
    );
    check('失焦后富文本保留', /<b>|font-weight:\s*bold|<strong>/i.test(storedBold || ''));

    // 7) 对齐吸附
    console.log('\n7) 拖拽对齐吸附');
    const readNodes = () =>
      evaluate(
        page,
        `[...document.querySelectorAll('.react-flow__node')].map(e => {
          const m = /translate\\(([-\\d.]+)px,\\s*([-\\d.]+)px\\)/.exec(e.style.transform) || [];
          return { id: e.dataset.id, x: Math.round(+m[1]), y: Math.round(+m[2]) };
        })`,
        false,
      );
    const clickAt = async (x, y) => {
      await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    };

    const before = await readNodes();
    const [na, nb] = before;
    const startPos = { ...nb };
    const grab = await evaluate(
      page,
      `(() => { const n = document.querySelectorAll('.react-flow__node')[1]; const r = n.getBoundingClientRect();
        return { x: Math.round(r.left + 30), y: Math.round(r.top + 12) }; })()`,
      false,
    );

    await page.send('Input.dispatchMouseEvent', {
      type: 'mousePressed', x: grab.x, y: grab.y, button: 'left', clickCount: 1,
    });
    await sleep(180);

    // 一点点挪到「比对齐位置偏 4px」的地方，再让吸附把它吸回去。
    // 每步都回读真实位置，避免 CDP 事件被合并导致误差累积。
    // 直接瞄「完全对齐」，这样即使拖动有 1~2px 误差，也一定落在吸附阈值里
    let pointerX = grab.x;
    for (let i = 0; i < 12; i++) {
      const cur = (await readNodes())[1];
      const delta = na.x - cur.x;
      if (Math.abs(delta) <= 2) break;
      // 指针目标单调推进：即使某次事件被合并，下一次坐标也不同，拖拽能继续
      pointerX += delta;
      await page.send('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: Math.round(pointerX),
        y: grab.y,
        button: 'left',
        buttons: 1,
      });
      await sleep(160);
    }

    const during = await evaluate(
      page,
      `(() => {
        const guides = document.querySelectorAll('[data-guide]').length;
        const els = [...document.querySelectorAll('.react-flow__node')];
        const m = (e) => /translate\\(([-\\d.]+)px,\\s*([-\\d.]+)px\\)/.exec(e.style.transform) || [];
        return { guides, x0: Math.round(+m(els[0])[1]), x1: Math.round(+m(els[1])[1]) };
      })()`,
      false,
    );
    await shot(page, '07-alignment');
    await page.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: Math.round(pointerX),
      y: grab.y,
      button: 'left',
      clickCount: 1,
    });
    await sleep(350);
    console.log('  drag:', JSON.stringify({ a: na, b: nb, during }));
    check('拖拽时出现对齐辅助线', during.guides > 0, `guides=${during.guides}`);
    check('左边缘被吸附到同一 x', Math.abs(during.x1 - during.x0) <= 1, `${during.x0} vs ${during.x1}`);
    const guidesGone = await evaluate(page, `document.querySelectorAll('[data-guide]').length`, false);
    check('拖拽结束后辅助线消失', guidesGone === 0, `实际 ${guidesGone}`);

    // 8) 置顶
    console.log('\n8) 置顶 / 置底');
    const zBefore = await evaluate(
      page,
      `[...document.querySelectorAll('.react-flow__node')].map(e => ({
        id: e.dataset.id, z: Number(e.style.zIndex || 0) }))`,
      false,
    );
    const lastRect = await evaluate(
      page,
      `(() => { const n = document.querySelectorAll('.react-flow__node')[0]; const r = n.getBoundingClientRect();
        return { x: Math.round(r.left + 40), y: Math.round(r.top + 20) }; })()`,
      false,
    );
    await clickAt(lastRect.x, lastRect.y);
    await sleep(350);
    const toFront = await evaluate(
      page,
      `(() => { const b = document.querySelector('.cv-node-toolbar__icon[title="置顶"]');
        if (!b) return false; b.click(); return true; })()`,
      false,
    );
    await sleep(350);
    const zAfter = await evaluate(
      page,
      `[...document.querySelectorAll('.cv-node')].map(e => Number(getComputedStyle(e.closest('.react-flow__node')).zIndex || 0))`,
      false,
    );
    check('置顶按钮可用', toFront === true);
    check('置顶后层级提升', Math.max(...zAfter) > Math.max(...zBefore.map((z) => z.z)),
      `${JSON.stringify(zBefore.map((z) => z.z))} -> ${JSON.stringify(zAfter)}`);

    // 9) 页面拖拽排序
    console.log('\n9) 页面拖拽排序');
    await evaluate(page, `document.querySelector('.cv-pages-head .cv-icon-btn').click()`, false);
    await sleep(500);
    const pagesBefore = await evaluate(
      page,
      `[...document.querySelectorAll('.cv-page-title')].map(e => e.textContent)`,
      false,
    );
    const reordered = await evaluate(
      page,
      `(() => {
        const items = document.querySelectorAll('.cv-pages li');
        if (items.length < 2) return { ok: false, n: items.length };
        const dt = new DataTransfer();
        items[1].dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
        items[0].dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
        items[0].dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
        return { ok: true };
      })()`,
      false,
    );
    await sleep(600);
    const pagesAfter = await evaluate(
      page,
      `[...document.querySelectorAll('.cv-page-title')].map(e => e.textContent)`,
      false,
    );
    console.log('  pages:', JSON.stringify({ pagesBefore, pagesAfter }));
    check('新建出第二页', pagesBefore.length >= 2, `实际 ${pagesBefore.length}`);
    check(
      '拖拽后顺序改变',
      pagesAfter.join('|') === [...pagesBefore].reverse().join('|'),
      `${pagesBefore} -> ${pagesAfter}`,
    );

    // 10) PDF：导入 → 版面切块 → 放到画布
    console.log('\n10) PDF 切块');
    await evaluate(
      page,
      `[...document.querySelectorAll('.cv-btn')].find(b => b.textContent.trim() === 'PDF').click()`,
      false,
    );
    await sleep(500);
    const panelOpen = await evaluate(page, `!!document.querySelector('.cv-pdf')`, false);
    check('PDF 面板能打开', panelOpen);

    // 通过 CDP 给隐藏的 file input 塞文件
    const doc = await page.send('DOM.getDocument', { depth: -1 });
    const inputNode = await page.send('DOM.querySelector', {
      nodeId: doc.result.root.nodeId,
      selector: '.cv-pdf input[type=file]',
    });
    check('找到文件选择框', !!inputNode.result?.nodeId);
    await page.send('DOM.setFileInputFiles', {
      nodeId: inputNode.result.nodeId,
      files: [process.env.PDF_FIXTURE || '/tmp/sample-layout.pdf'],
    });
    await sleep(2500);

    const pdfState = await evaluate(
      page,
      `(() => ({
        regions: document.querySelectorAll('.cv-pdf-region').length,
        status: (document.querySelector('.cv-pdf-status') || {}).textContent || '',
        mode: (document.querySelector('.cv-pdf-model') || {}).textContent || '',
        items: [...document.querySelectorAll('.cv-pdf-item__text')].map(e => e.textContent).slice(0, 4),
      }))()`,
      false,
    );
    console.log('  pdf:', JSON.stringify(pdfState));
    check('切出多个版面区域', pdfState.regions >= 2, `实际 ${pdfState.regions}`);
    check('区域带上了文字', (pdfState.items || []).some((t) => t && t.trim().length > 8));
    await shot(page, '08-pdf-regions');

    const nodesBeforePdf = await evaluate(page, `document.querySelectorAll('.cv-node').length`, false);
    await evaluate(
      page,
      `(() => { const b = document.querySelector('.cv-pdf-region .cv-pdf-add');
        if (!b) return false; b.click(); return true; })()`,
      false,
    );
    await sleep(900);
    const pdfNode = await evaluate(
      page,
      `(() => ({
        count: document.querySelectorAll('.cv-node--pdf').length,
        total: document.querySelectorAll('.cv-node').length,
        badge: (document.querySelector('.cv-pdf-badge') || {}).textContent || '',
        hasImg: !!document.querySelector('.cv-pdf-img'),
      }))()`,
      false,
    );
    console.log('  node:', JSON.stringify(pdfNode));
    check('PDF 区域放进了画布', pdfNode.count === 1, `实际 ${pdfNode.count}`);
    check('裁切块带截图', pdfNode.hasImg);
    check('画布节点数 +1', pdfNode.total === nodesBeforePdf + 1);
    await shot(page, '09-pdf-node');

    // 再放一块「正文」，检查裁切块在真实文本区域上的可读性
    const addedText = await evaluate(
      page,
      `(() => {
        // 挑页面上面积最大的那块（通常是最难读的整段正文）
        const regions = [...document.querySelectorAll('.cv-pdf-region')];
        if (regions.length === 0) return false;
        const biggest = regions
          .map((r) => ({ r, a: r.getBoundingClientRect().width * r.getBoundingClientRect().height }))
          .sort((x, y) => y.a - x.a)[0];
        biggest.r.querySelector('.cv-pdf-add').click();
        return true;
      })()`,
      false,
    );
    await sleep(900);
    const textNode = await evaluate(
      page,
      `(() => {
        const n = document.querySelectorAll('.cv-node--pdf')[1];
        if (!n) return null;
        const r = n.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height),
                 badge: (n.querySelector('.cv-pdf-badge') || {}).textContent,
                 hasTextBtn: !!n.querySelector('.cv-pdf-textbtn') };
      })()`,
      false,
    );
    console.log('  text node:', JSON.stringify(textNode), 'added=', addedText);
    const imgDiag = await evaluate(
      page,
      `(() => {
        const n = document.querySelectorAll('.cv-node--pdf')[1];
        const img = n && n.querySelector('.cv-pdf-img');
        const body = n && n.querySelector('.cv-pdf-body');
        if (!img || !body) return null;
        const ir = img.getBoundingClientRect(), br = body.getBoundingClientRect();
        return { natural: [img.naturalWidth, img.naturalHeight],
                 img: [Math.round(ir.width), Math.round(ir.height)],
                 body: [Math.round(br.width), Math.round(br.height)],
                 fit: getComputedStyle(img).objectFit };
      })()`,
      false,
    );
    console.log('  img diag:', JSON.stringify(imgDiag));

    // 把裁切出来的原始 PNG 落盘，方便直接看裁得准不准
    const dataUrl = await evaluate(
      page,
      `(async () => {
        const n = document.querySelectorAll('.cv-node--pdf')[1];
        const img = n.querySelector('.cv-pdf-img');
        const blob = await (await fetch(img.src)).blob();
        return await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
      })()`,
    );
    if (typeof dataUrl === 'string') {
      writeFileSync(join(OUT_DIR, '09c-crop-raw.png'), Buffer.from(dataUrl.split(',')[1], 'base64'));
      console.log('  📸 原始裁切图已保存 09c-crop-raw.png');
    }
    check('正文裁切块按原始比例放（不再固定 420）', (textNode?.w ?? 0) >= 430, `实际 ${textNode?.w}`);
    check('有文字的区域带「文字」开关', textNode?.hasTextBtn === true);
    await shot(page, '09b-pdf-text-node');

    // 11) 右键菜单
    console.log('\n11) 空白处右键菜单');
    const paneRect = await evaluate(
      page,
      `(() => { const p = document.querySelector('.react-flow__pane'); const r = p.getBoundingClientRect();
        return { x: Math.round(r.left + r.width - 120), y: Math.round(r.top + r.height - 120) }; })()`,
      false,
    );
    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: paneRect.x, y: paneRect.y, button: 'right', clickCount: 1 });
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: paneRect.x, y: paneRect.y, button: 'right', clickCount: 1 });
    await sleep(500);
    const menuState = await evaluate(
      page,
      `(() => { const m = document.querySelector('.cv-menu');
        return m ? { open: true, items: [...m.querySelectorAll('.cv-menu__item')].map(b => b.textContent) } : { open: false }; })()`,
      false,
    );
    console.log('  menu:', JSON.stringify(menuState));
    check('右键弹出菜单', menuState.open);
    check('菜单内容正确', (menuState.items || []).some((t) => t.includes('新建笔记')));
    await shot(page, '10-context-menu');

    const beforeMenuCreate = await evaluate(page, `document.querySelectorAll('.cv-node').length`, false);
    await evaluate(
      page,
      `[...document.querySelectorAll('.cv-menu__item')].find(b => b.textContent.includes('新建待办')).click()`,
      false,
    );
    await sleep(600);
    await evaluate(page, `document.activeElement && document.activeElement.blur()`, false);
    await sleep(300);
    const afterMenuCreate = await evaluate(page, `document.querySelectorAll('.cv-node').length`, false);
    check('右键菜单新建节点生效', afterMenuCreate === beforeMenuCreate + 1, `${beforeMenuCreate} -> ${afterMenuCreate}`);
    check('菜单已关闭', !(await evaluate(page, `!!document.querySelector('.cv-menu')`, false)));

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
