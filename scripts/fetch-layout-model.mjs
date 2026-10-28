// 下载 PP-DocLayout-S 的 ONNX 布局模型到 public/models/。
// 文件约 4.9 MB，不提交进仓库（模型有自己的许可，且不想让 git 变胖）。
//
//   pnpm fetch:model              # 走默认源（ModelScope，国内快）
//   MIRROR=hf pnpm fetch:model    # 走 HuggingFace
//
// 没下载也能用：画布会自动回退到「按文字行聚类」的布局分析，
// 只是扫描件（没有文字层）就分不出区域了。
import { createWriteStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(root, 'public', 'models');
const OUT_FILE = join(OUT_DIR, 'pp_doclayout_s.onnx');

const SOURCES = {
  modelscope:
    'https://www.modelscope.cn/models/RapidAI/RapidDoc/resolve/master/layout/PP-DocLayout-S/pp_doclayout_s.onnx',
  hf: 'https://huggingface.co/PaddleOcrNet/PaddleOcrNet-models/resolve/main/PP-DocLayout-S.onnx',
};

/** 下载完成后用来核对文件完整性 */
const EXPECTED_SHA256 = '0ae97252feb0d64ee2c70ee0449ec9de4b08140056f32ce3c725c16ca50142e4';

const mirror = process.env.MIRROR === 'hf' ? 'hf' : 'modelscope';
const url = SOURCES[mirror];

if (existsSync(OUT_FILE)) {
  const size = statSync(OUT_FILE).size;
  if (size > 4_000_000) {
    console.log(`模型已存在：${OUT_FILE} (${(size / 1024 / 1024).toFixed(2)} MB)`);
    process.exit(0);
  }
  console.log('已有文件但大小不对，重新下载…');
}

mkdirSync(OUT_DIR, { recursive: true });
console.log(`从 ${mirror} 下载 ${url}`);

const res = await fetch(url, {
  redirect: 'follow',
  headers: { 'user-agent': 'word-shadowing-plugin/fetch-layout-model' },
});
if (!res.ok || !res.body) {
  console.error(`下载失败：HTTP ${res.status}`);
  process.exit(1);
}

const hash = createHash('sha256');
const chunks = [];
for await (const chunk of Readable.fromWeb(res.body)) {
  chunks.push(chunk);
  hash.update(chunk);
}
const buf = Buffer.concat(chunks);
const digest = hash.digest('hex');

if (EXPECTED_SHA256 && digest !== EXPECTED_SHA256) {
  console.warn(`⚠️ sha256 与预期不同\n  实际 ${digest}\n  预期 ${EXPECTED_SHA256}`);
}

const { writeFileSync } = await import('node:fs');
writeFileSync(OUT_FILE, buf);
console.log(`已写入 ${OUT_FILE}（${(buf.length / 1024 / 1024).toFixed(2)} MB）`);
