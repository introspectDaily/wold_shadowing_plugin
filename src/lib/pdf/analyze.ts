/**
 * 版面分析的总入口。
 *
 * 两条信息来源，随时可能只有其中一条：
 *   1. 文字层（数字版 PDF 有，扫描件/图片没有）
 *   2. PP-DocLayout-S 布局模型（装了模型才有）
 *
 * 策略：
 *   - 有文字层：文字块聚类兜底，模型可用时用模型的框（能识别图片/表格），文字按覆盖关系补进去
 *   - 没文字层（扫描件/图片）：只能靠模型切块，切出来的文字区域再跑 PP-OCRv6 识别
 */
import { clusterTextItems, type Region, type TextItem } from './layout';
import { ocrRegion } from './ocr';
import { analyzeLayoutWithModel, getLayoutError } from './paddleLayout';
import { cropCanvas } from './pdfDoc';

export interface AnalyzeResult {
  regions: Region[];
  mode: 'model' | 'text' | 'none';
  /** 页面是否有文字层（判断是不是扫描件） */
  hasTextLayer: boolean;
  /** 模型不可用时的原因，给 UI 展示 */
  modelError?: string | null;
  /** 是否跑过 OCR */
  ocrUsed?: boolean;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * 模型只给框不给字，文字还得从文字层取。
 * 同时用文字的真实范围把框撑开 —— 模型框常常比正文窄一点点，
 * 直接裁会把每行右边切掉，读起来很难受。
 */
function attachText(regions: Region[], textRegions: Region[]): Region[] {
  return regions.map((r) => {
    const hit = textRegions.filter(
      (t) => t.x + t.w > r.x && t.x < r.x + r.w && t.y + t.h > r.y && t.y < r.y + r.h,
    );

    let box = { x: r.x, y: r.y, w: r.w, h: r.h };
    if (hit.length > 0) {
      const x0 = Math.min(r.x, ...hit.map((t) => t.x));
      const y0 = Math.min(r.y, ...hit.map((t) => t.y));
      const x1 = Math.max(r.x + r.w, ...hit.map((t) => t.x + t.w));
      const y1 = Math.max(r.y + r.h, ...hit.map((t) => t.y + t.h));
      if ((x1 - x0) * (y1 - y0) <= r.w * r.h * 1.6) {
        box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      }
    }

    const padX = 0.006;
    const padY = 0.004;
    const x = clamp01(box.x - padX);
    const y = clamp01(box.y - padY);
    return {
      ...r,
      x,
      y,
      w: clamp01(box.x + box.w + padX) - x,
      h: clamp01(box.y + box.h + padY) - y,
      text: hit.length ? hit.map((t) => t.text ?? '').join('\n').trim() : r.text,
    };
  });
}

/** 这些类别才值得 OCR；图片/表格/公式就留给截图 */
const OCR_KINDS = new Set(['text', 'title', 'caption', 'header', 'footer', 'other']);

/** 对没有文字的文本区域跑 OCR */
async function ocrRegions(
  regions: Region[],
  canvas: HTMLCanvasElement,
): Promise<{ regions: Region[]; used: boolean }> {
  let used = false;
  const out: Region[] = [];
  for (const r of regions) {
    if (r.text && r.text.trim()) {
      out.push(r);
      continue;
    }
    if (!OCR_KINDS.has(r.kind)) {
      out.push(r);
      continue;
    }
    // 太小的块不值得识别（页码碎块之类）
    if (r.w * canvas.width < 24 || r.h * canvas.height < 12) {
      out.push(r);
      continue;
    }
    const text = await ocrRegion(cropCanvas(canvas, r));
    if (text) used = true;
    out.push({ ...r, text });
  }
  return { regions: out, used };
}

/**
 * 核心入口：给定一张页面画布 + 可选的文字层，返回版面区域。
 */
export async function analyzeCanvas(
  canvas: HTMLCanvasElement,
  textItems: TextItem[] | null,
  pageWidth: number,
  pageHeight: number,
): Promise<AnalyzeResult> {
  const hasTextLayer = (textItems?.length ?? 0) > 4;
  const textRegions = hasTextLayer
    ? clusterTextItems(textItems!, pageWidth, pageHeight)
    : [];
  const modelRegions = await analyzeLayoutWithModel(canvas);

  if (modelRegions && modelRegions.length > 0) {
    let regions = hasTextLayer ? attachText(modelRegions, textRegions) : modelRegions;
    let ocrUsed = false;
    if (!hasTextLayer) {
      const res = await ocrRegions(regions, canvas);
      regions = res.regions;
      ocrUsed = res.used;
    }
    return { regions, mode: 'model', hasTextLayer, ocrUsed };
  }

  if (hasTextLayer) {
    return { regions: textRegions, mode: 'text', hasTextLayer, modelError: getLayoutError() };
  }

  return { regions: [], mode: 'none', hasTextLayer, modelError: getLayoutError() };
}
