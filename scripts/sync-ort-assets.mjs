// 把 onnxruntime-web 的 wasm 运行时拷进 public/ort/。
// 原因：扩展的 CSP 不允许从 CDN 加载，pakcage 的 exports 又不允许直接 ?url 导入，
// 所以打包前复制一份，运行时用 chrome.runtime.getURL('ort/...') 指过去。
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'ort');

// package.json 的 exports 没有暴露 package.json，直接按 node_modules 路径取
const ortDist = join(root, 'node_modules', 'onnxruntime-web', 'dist');
const files = ['ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.mjs'];

// 模型没下载就不带 ORT 运行时：14MB 的 wasm 白塞进扩展包不值当，
// 这种情况下应用会自动回退到「文字块」布局分析。
const modelDir = join(root, 'public', 'models');
const hasModel =
  existsSync(modelDir) &&
  (await import('node:fs')).readdirSync(modelDir).some((f) => f.endsWith('.onnx'));
if (!hasModel) {
  console.log('未发现布局模型（pnpm fetch:model），跳过 ORT 运行时拷贝 → 使用文字块分析');
  process.exit(0);
}

mkdirSync(outDir, { recursive: true });
for (const f of files) {
  const src = join(ortDist, f);
  const dst = join(outDir, f);
  if (!existsSync(src)) {
    console.warn(`⚠️ 缺少 ${f}，跳过`);
    continue;
  }
  if (existsSync(dst) && statSync(dst).size === statSync(src).size) continue;
  copyFileSync(src, dst);
  console.log(`synced public/ort/${f}`);
}
