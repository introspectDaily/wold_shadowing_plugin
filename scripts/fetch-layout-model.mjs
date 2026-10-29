// 下载 PP-DocLayout-S 的 ONNX 布局模型到 public/models/。
// 文件约 4.9 MB，不提交进仓库（模型有自己的许可，且不想让 git 变胖）。
//
//   pnpm fetch:model              # 走默认源（ModelScope，国内快）
//   MIRROR=hf pnpm fetch:model    # 走 HuggingFace
//
// 没下载也能用：画布会自动回退到「按文字行聚类」的布局分析，
// 只是扫描件（没有文字层）就分不出区域了。
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
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

async function download(url, outFile, expectedSha, minSize) {
  if (existsSync(outFile) && statSync(outFile).size >= minSize) {
    console.log(`已存在：${outFile} (${(statSync(outFile).size / 1024 / 1024).toFixed(2)} MB)`);
    return;
  }
  mkdirSync(dirname(outFile), { recursive: true });
  console.log(`下载 ${url}`);
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': 'word-shadowing-plugin/fetch-models' },
  });
  if (!res.ok || !res.body) throw new Error(`下载失败：HTTP ${res.status}`);

  const hash = createHash('sha256');
  const chunks = [];
  for await (const chunk of Readable.fromWeb(res.body)) {
    chunks.push(chunk);
    hash.update(chunk);
  }
  const buf = Buffer.concat(chunks);
  const digest = hash.digest('hex');
  if (expectedSha && digest !== expectedSha) {
    console.warn(`⚠️ sha256 与预期不同\n  实际 ${digest}\n  预期 ${expectedSha}`);
  }
  writeFileSync(outFile, buf);
  console.log(`✅ ${outFile}（${(buf.length / 1024 / 1024).toFixed(2)} MB）`);
}

// 1) 版面分析
await download(url, OUT_FILE, EXPECTED_SHA256, 4_000_000);

// 2) OCR 识别（扫描件/图片用）
const OCR_BASE = 'https://www.modelscope.cn/models/RapidAI/RapidOCR/resolve/master/onnx/PP-OCRv6/rec';
await download(join(OCR_BASE, 'PP-OCRv6_rec_tiny.onnx'), join(OUT_DIR, 'ppocrv6_rec_tiny.onnx'), null, 4_000_000);

// 3) 字典（模型输出 6906 类 = blank + 6904 字典 + 空格）
const DICT_FILE = join(OUT_DIR, 'ppocrv6_dict.txt');
const dictRes = await fetch(
  'https://www.modelscope.cn/models/PaddlePaddle/PP-OCRv6_tiny_rec/resolve/master/inference.yml',
  { redirect: 'follow' },
);
if (dictRes.ok && !existsSync(DICT_FILE)) {
  const yml = await dictRes.text();
  const m = /character_dict:\n((?:\s*-\s.*\n)+)/.exec(yml);
  if (m) {
    const chars = m[1]
      .split('\n')
      .filter(Boolean)
      .map((l) => l.trim().slice(2).trim().replace(/^'(.*)'$/, '$1').replace(/^"(.*)"$/, '$1'));
    writeFileSync(DICT_FILE, `${chars.join('\n')}\n `);
    console.log(`✅ ${DICT_FILE}（${chars.length} 字符）`);
  }
}
