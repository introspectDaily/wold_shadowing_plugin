/**
 * PaddleOCR 的 PP-DocLayout-S 版面分析（ONNX，纯前端推理）。
 *
 * 模型契约（已实测，来自 PaddlePaddle/PP-DocLayout-S 的 config.json）：
 *   输入  image        [1,3,480,480] float32  —— 直接拉伸到 480×480，keep_ratio=false
 *   输入  scale_factor [1,2]         float32  —— [480/页高, 480/页宽]，模型据此把框映射回原图
 *   输出  fetch_name_0 [N,6]         —— 每行 [类别id, 分数, x1, y1, x2, y2]（原图像素）
 *
 * 归一化：scale=1/255，mean=[0.485,0.456,0.406]，std=[0.229,0.224,0.225]，CHW 排列。
 * 模型约 4.9MB，默认不进仓库，用 `pnpm fetch:model` 下载到 public/models/。
 */
import { DOCLAYOUT_LABELS, LABEL_TO_KIND, type Region } from './layout';

const MODEL_PATH = 'models/pp_doclayout_s.onnx';
const INPUT_SIZE = 480;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];
const SCORE_THRESHOLD = 0.45;

// 只引 wasm 后端：默认入口会把 jsep/webgpu 的 29MB wasm 也打进来
type OrtModule = typeof import('onnxruntime-web/wasm');
type OrtSession = import('onnxruntime-web/wasm').InferenceSession;

let ortPromise: Promise<OrtModule> | null = null;
let sessionPromise: Promise<OrtSession | null> | null = null;
let lastError: string | null = null;

/** 最近一次模型加载/推理失败的原因，UI 上用来解释为什么回退了 */
export function getLayoutError(): string | null {
  return lastError;
}

function modelUrl(): string {
  return chrome.runtime.getURL(MODEL_PATH);
}

/** 模型装没装：直接 HEAD 一下扩展内的文件 */
export async function isLayoutModelAvailable(): Promise<boolean> {
  try {
    // 扩展协议对 HEAD 支持不好，用 GET 拿到响应头立刻掐断 body，
    // 这样既不会白下载 5MB，也能确认文件真实存在。
    const res = await fetch(modelUrl());
    const ok = res.ok;
    await res.body?.cancel().catch(() => {});
    return ok;
  } catch {
    return false;
  }
}

async function loadOrt(): Promise<OrtModule> {
  if (!ortPromise) {
    ortPromise = (async () => {
      const ort = await import('onnxruntime-web/wasm');
      // wasm 运行时由 scripts/sync-ort-assets.mjs 拷到 public/ort/，
      // 指向扩展内部地址；单线程跑（扩展页面不是 crossOriginIsolated）。
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.wasmPaths = chrome.runtime.getURL('ort/');
      return ort;
    })();
  }
  return ortPromise;
}

async function getSession(): Promise<OrtSession | null> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      try {
        if (!(await isLayoutModelAvailable())) return null;
        const ort = await loadOrt();
        const res = await fetch(modelUrl());
        const bytes = new Uint8Array(await res.arrayBuffer());
        return await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'] });
      } catch (err) {
        lastError = (err as Error)?.message ?? String(err);
        console.warn('[layout] 模型加载失败，将回退到文字块分析', err);
        return null;
      }
    })();
  }
  return sessionPromise;
}

/** 页面画布 → 480×480 CHW float32 */
function preprocess(source: HTMLCanvasElement): Float32Array {
  const off = document.createElement('canvas');
  off.width = INPUT_SIZE;
  off.height = INPUT_SIZE;
  const ctx = off.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('无法创建 canvas 上下文');
  ctx.drawImage(source, 0, 0, INPUT_SIZE, INPUT_SIZE);
  const { data } = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);

  const out = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);
  const plane = INPUT_SIZE * INPUT_SIZE;
  for (let i = 0; i < plane; i++) {
    const r = data[i * 4]! / 255;
    const g = data[i * 4 + 1]! / 255;
    const b = data[i * 4 + 2]! / 255;
    out[i] = (r - MEAN[0]!) / STD[0]!;
    out[plane + i] = (g - MEAN[1]!) / STD[1]!;
    out[2 * plane + i] = (b - MEAN[2]!) / STD[2]!;
  }
  return out;
}

/** 跑模型拿区域；模型不可用时返回 null（调用方回退到文字块分析） */
export async function analyzeLayoutWithModel(
  canvas: HTMLCanvasElement,
): Promise<Region[] | null> {
  const session = await getSession();
  if (!session) {
    if (!lastError && !(await isLayoutModelAvailable())) {
      lastError = '未找到模型文件（pnpm fetch:model）';
    }
    return null;
  }

  try {
    return await runModel(session, canvas);
  } catch (err) {
    lastError = (err as Error)?.message ?? String(err);
    console.warn('[layout] 推理失败', err);
    return null;
  }
}

async function runModel(session: OrtSession, canvas: HTMLCanvasElement): Promise<Region[]> {
  const ort = await loadOrt();
  const input = new ort.Tensor('float32', preprocess(canvas), [1, 3, INPUT_SIZE, INPUT_SIZE]);
  const scale = new ort.Tensor(
    'float32',
    new Float32Array([INPUT_SIZE / canvas.height, INPUT_SIZE / canvas.width]),
    [1, 2],
  );

  const feeds: Record<string, import('onnxruntime-web/wasm').Tensor> = {
    image: input,
    scale_factor: scale,
  };
  const output = await session.run(feeds);
  const boxes = output[session.outputNames[0]!];
  if (!boxes) return [];

  const regions: Region[] = [];
  const rows = boxes.dims[0] ?? 0;
  const data = boxes.data as Float32Array;

  for (let i = 0; i < rows; i++) {
    const cls = Math.round(data[i * 6]!);
    const score = data[i * 6 + 1]!;
    // 注意：输出**不是**按分数排序的，不能遇到低的就 break
    if (score < SCORE_THRESHOLD) continue;
    const x1 = data[i * 6 + 2]!;
    const y1 = data[i * 6 + 3]!;
    const x2 = data[i * 6 + 4]!;
    const y2 = data[i * 6 + 5]!;
    const label = DOCLAYOUT_LABELS[cls] ?? 'text';

    const x = Math.max(0, Math.min(1, x1 / canvas.width));
    const y = Math.max(0, Math.min(1, y1 / canvas.height));
    const w = Math.max(0, Math.min(1, x2 / canvas.width)) - x;
    const h = Math.max(0, Math.min(1, y2 / canvas.height)) - y;
    if (w <= 0.005 || h <= 0.003) continue;

    regions.push({
      x,
      y,
      w,
      h,
      kind: LABEL_TO_KIND[label] ?? 'other',
      score,
      source: 'model',
      text: '',
    });
  }

  return regions.sort((a, b) => a.y - b.y || a.x - b.x);
}

export function resetLayoutModel(): void {
  sessionPromise = null;
}
