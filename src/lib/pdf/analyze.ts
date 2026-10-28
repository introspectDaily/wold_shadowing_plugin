/**
 * 版面分析的总入口：优先用 PP-DocLayout-S 模型，拿不到就回退到文字块聚类。
 *
 * 两种结果都归一化成同一套 Region，上层 UI 完全不用关心来源。
 */
import { clusterTextItems, type Region } from './layout';
import { analyzeLayoutWithModel, getLayoutError } from './paddleLayout';
import { extractTextItems, type PdfHandle } from './pdfDoc';

export interface AnalyzeResult {
  regions: Region[];
  mode: 'model' | 'text' | 'none';
  /** 页面是否有文字层（判断是不是扫描件） */
  hasTextLayer: boolean;
  /** 模型不可用时的原因，给 UI 展示 */
  modelError?: string | null;
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
      // 撑开幅度限制在原区域的 1.6 倍以内，避免把整页都框进来
      if ((x1 - x0) * (y1 - y0) <= r.w * r.h * 1.6) {
        box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      }
    }

    // 再留一点边距，保证文字不会贴着裁切边缘
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

export async function analyzePage(
  pdf: PdfHandle,
  pageNumber: number,
  canvas: HTMLCanvasElement,
): Promise<AnalyzeResult> {
  const { items, pageWidth, pageHeight } = await extractTextItems(pdf, pageNumber);
  const hasTextLayer = items.length > 4;

  if (hasTextLayer) {
    const textRegions = clusterTextItems(items, pageWidth, pageHeight);
    const modelRegions = await analyzeLayoutWithModel(canvas);

    if (modelRegions && modelRegions.length > 0) {
      // 有模型时用模型的框（能识别图片/表格/公式这些没有文字的区域），
      // 文字从文字层按覆盖关系补进去
      return { regions: attachText(modelRegions, textRegions), mode: 'model', hasTextLayer };
    }
    return { regions: textRegions, mode: 'text', hasTextLayer, modelError: getLayoutError() };
  }

  // 扫描件：没有文字层，只能靠模型
  const modelRegions = await analyzeLayoutWithModel(canvas);
  if (modelRegions && modelRegions.length > 0) {
    return { regions: modelRegions, mode: 'model', hasTextLayer };
  }
  return { regions: [], mode: 'none', hasTextLayer, modelError: getLayoutError() };
}
