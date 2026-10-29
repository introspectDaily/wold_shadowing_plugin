/**
 * PP-OCRv6 tiny 文字识别（ONNX，纯前端）。
 *
 * 模型契约（实测）：
 *   rec 输入  x      [N,3,48,W] float32，**BGR** 通道，/255 后 (x-0.5)/0.5
 *   rec 输出  [N,T,C]  C=6906 = 1 blank + 6904 字典 + 1 空格
 *
 * 为什么只跑识别、不跑检测：
 *   版面模型已经给出区域框了，区域内部再用「水平投影」切行（纯 JS、零模型），
 *   省掉 1.7MB 的 DBNet，也不会因为倾斜/噪声把检测搞崩。
 */
import type * as OrtNs from 'onnxruntime-web/wasm';

const REC_PATH = 'models/ppocrv6_rec_tiny.onnx';
const DICT_PATH = 'models/ppocrv6_dict.txt';
const REC_HEIGHT = 48;

let dictPromise: Promise<string[]> | null = null;
let sessionPromise: Promise<OrtNs.InferenceSession | null> | null = null;
let ortPromise: Promise<typeof import('onnxruntime-web/wasm')> | null = null;

async function loadOrt() {
  if (!ortPromise) {
    ortPromise = (async () => {
      const ort = await import('onnxruntime-web/wasm');
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.wasmPaths = chrome.runtime.getURL('ort/');
      return ort;
    })();
  }
  return ortPromise;
}

export async function isOcrAvailable(): Promise<boolean> {
  try {
    const res = await fetch(chrome.runtime.getURL(REC_PATH));
    const ok = res.ok;
    await res.body?.cancel().catch(() => {});
    return ok;
  } catch {
    return false;
  }
}

async function getDict(): Promise<string[]> {
  if (!dictPromise) {
    dictPromise = fetch(chrome.runtime.getURL(DICT_PATH))
      .then((r) => (r.ok ? r.text() : ''))
      .then((t) => t.split('\n'));
  }
  return dictPromise;
}

async function getSession(): Promise<OrtNs.InferenceSession | null> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      try {
        if (!(await isOcrAvailable())) return null;
        const ort = await loadOrt();
        const bytes = new Uint8Array(await (await fetch(chrome.runtime.getURL(REC_PATH))).arrayBuffer());
        return await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'] });
      } catch (err) {
        console.warn('[ocr] 识别模型加载失败', err);
        return null;
      }
    })();
  }
  return sessionPromise;
}

/* ----------------------------- 行切分 ----------------------------- */

interface LineBox {
  y0: number;
  y1: number;
}

/** 水平投影切行：统计每一行的“墨迹”像素，连续有字的行归为一行文字 */
export function splitLines(ctx: CanvasRenderingContext2D, width: number, height: number): LineBox[] {
  const { data } = ctx.getImageData(0, 0, width, height);
  const ink = new Float32Array(height);
  for (let y = 0; y < height; y++) {
    let sum = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const lum = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
      if (lum < 200) sum += 1;
    }
    ink[y] = sum / width;
  }

  const positive = Array.from(ink).filter((v) => v > 0.01);
  const mean = positive.length ? positive.reduce((a, b) => a + b, 0) / positive.length : 0;
  const threshold = Math.max(0.008, mean * 0.35);

  const lines: LineBox[] = [];
  let start = -1;
  let gap = 0;
  for (let y = 0; y < height; y++) {
    const hasInk = ink[y]! > threshold;
    if (hasInk) {
      if (start < 0) start = y;
      gap = 0;
    } else if (start >= 0) {
      gap += 1;
      // 连续空白超过行高的一半，就认为这一行结束
      if (gap > Math.max(3, (y - start) * 0.45)) {
        lines.push({ y0: start, y1: y - gap });
        start = -1;
        gap = 0;
      }
    }
  }
  if (start >= 0) lines.push({ y0: start, y1: height - 1 });

  return lines.filter((l) => l.y1 - l.y0 >= 6);
}

/* ----------------------------- 识别 ----------------------------- */

function toRecInput(source: HTMLCanvasElement): { data: Float32Array; width: number } {
  const ratio = source.width / source.height;
  let w = Math.round(REC_HEIGHT * ratio);
  w = Math.max(16, Math.ceil(w / 8) * 8);

  const off = document.createElement('canvas');
  off.width = w;
  off.height = REC_HEIGHT;
  const ctx = off.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('canvas 上下文创建失败');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, REC_HEIGHT);
  ctx.drawImage(source, 0, 0, w, REC_HEIGHT);

  const { data } = ctx.getImageData(0, 0, w, REC_HEIGHT);
  const out = new Float32Array(3 * REC_HEIGHT * w);
  const plane = REC_HEIGHT * w;
  for (let i = 0; i < plane; i++) {
    // 模型训练时是 BGR
    const r = data[i * 4]! / 255;
    const g = data[i * 4 + 1]! / 255;
    const b = data[i * 4 + 2]! / 255;
    out[i] = (b - 0.5) / 0.5;
    out[plane + i] = (g - 0.5) / 0.5;
    out[2 * plane + i] = (r - 0.5) / 0.5;
  }
  return { data: out, width: w };
}

/** CTC 贪心解码：取每帧最大类、合并重复、去掉 blank */
function ctcDecode(logits: Float32Array, steps: number, classes: number, dict: string[]): string {
  let prev = -1;
  let text = '';
  for (let t = 0; t < steps; t++) {
    let best = 0;
    let bestScore = -Infinity;
    for (let c = 0; c < classes; c++) {
      const v = logits[t * classes + c]!;
      if (v > bestScore) {
        bestScore = v;
        best = c;
      }
    }
    if (best !== 0 && best !== prev) {
      text += dict[best - 1] ?? '';
    }
    prev = best;
  }
  return text;
}

/** 识别一行 */
async function recognizeLine(
  canvas: HTMLCanvasElement,
  session: OrtNs.InferenceSession,
  dict: string[],
): Promise<string> {
  const ort = await loadOrt();
  const { data, width } = toRecInput(canvas);
  const tensor = new ort.Tensor('float32', data, [1, 3, REC_HEIGHT, width]);
  const output = await session.run({ x: tensor });
  const out = output[session.outputNames[0]!];
  if (!out) return '';
  const dims = out.dims;
  const steps = dims[1] ?? 0;
  const classes = dims[2] ?? 0;
  return ctcDecode(out.data as Float32Array, steps, classes, dict);
}

/**
 * 对一个区域做 OCR：切行 → 逐行识别 → 按行拼接。
 * 返回空字符串表示没识别出内容。
 */
export async function ocrRegion(canvas: HTMLCanvasElement): Promise<string> {
  const session = await getSession();
  if (!session) return '';
  const dict = await getDict();

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return '';
  const lines = splitLines(ctx, canvas.width, canvas.height);
  if (lines.length === 0) return '';

  const parts: string[] = [];
  for (const line of lines) {
    const h = line.y1 - line.y0;
    if (h < 6) continue;
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = h;
    slice.getContext('2d')?.drawImage(canvas, 0, line.y0, canvas.width, h, 0, 0, canvas.width, h);
    const text = await recognizeLine(slice, session, dict);
    if (text.trim()) parts.push(text.trim());
  }
  return parts.join('\n');
}
