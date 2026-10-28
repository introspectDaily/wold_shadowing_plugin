/**
 * 文档版面区域的通用模型。
 *
 * 坐标系统一用**归一化 0~1**（相对页面宽高），这样渲染缩放、DPR 变了
 * 都不会影响已存的区域和画布节点。
 */
export type RegionKind =
  | 'title'
  | 'text'
  | 'image'
  | 'table'
  | 'formula'
  | 'caption'
  | 'header'
  | 'footer'
  | 'number'
  | 'other';

export interface Box {
  /** 0~1，左上角起点 */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Region extends Box {
  kind: RegionKind;
  /** 区域内能拿到的文字（数字版 PDF 有，扫描件没有） */
  text?: string;
  /** 模型置信度；文字聚类出来的没有 */
  score?: number;
  source: 'text' | 'model' | 'manual';
}

/** pdf.js 的文字片段（页面坐标系，左上角为原点，单位 pt） */
export interface TextItem {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function toRegion(
  box: { x0: number; y0: number; x1: number; y1: number },
  pageW: number,
  pageH: number,
  extra: Partial<Region>,
): Region {
  const x = clamp01(box.x0 / pageW);
  const y = clamp01(box.y0 / pageH);
  return {
    x,
    y,
    w: clamp01(box.x1 / pageW) - x,
    h: clamp01(box.y1 / pageH) - y,
    kind: 'text',
    source: 'text',
    ...extra,
  };
}

interface Line {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  h: number;
}

/**
 * 把文字片段先聚成「行」，再把行聚成「段」。
 *
 * 这是没有布局模型时的主力方案：数字版 PDF 的文字层质量很高，
 * 只要按「同一基线的归一行、行距小的归一段」就能切得很准。
 */
export function clusterTextItems(
  items: TextItem[],
  pageW: number,
  pageH: number,
): Region[] {
  const usable = items.filter((i) => i.str.trim().length > 0 && i.w > 0);
  if (usable.length === 0) return [];

  // 1) 按 y 中心聚行
  const sorted = [...usable].sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2) || a.x - b.x);
  const lines: Line[] = [];
  for (const it of sorted) {
    const cy = it.y + it.h / 2;
    const line = lines[lines.length - 1];
    if (line && Math.abs(cy - (line.y0 + line.y1) / 2) <= Math.max(line.h, it.h) * 0.6) {
      const gap = it.x - line.x1;
      if (gap > 0 && gap < it.h * 0.8) line.text += ' ';
      line.text += it.str;
      line.x1 = Math.max(line.x1, it.x + it.w);
      line.y0 = Math.min(line.y0, it.y);
      line.y1 = Math.max(line.y1, it.y + it.h);
      line.h = Math.max(line.h, it.h);
    } else {
      lines.push({
        text: it.str,
        x0: it.x,
        y0: it.y,
        x1: it.x + it.w,
        y1: it.y + it.h,
        h: it.h,
      });
    }
  }

  if (lines.length === 0) return [];

  const heights = lines.map((l) => l.h).sort((a, b) => a - b);
  const medianH = heights[Math.floor(heights.length / 2)] || 10;

  // 2) 行 → 段：行距足够小、且水平方向有重叠，就归到同一段
  type Block = { x0: number; y0: number; x1: number; y1: number; text: string; lines: number };
  const blocks: Block[] = [];
  for (const l of lines.sort((a, b) => a.y0 - b.y0)) {
    let merged = false;
    for (let i = blocks.length - 1; i >= 0; i--) {
      const b = blocks[i]!;
      const gapY = l.y0 - b.y1;
      const overlap = Math.min(b.x1, l.x1) - Math.max(b.x0, l.x0);
      const minW = Math.min(b.x1 - b.x0, l.x1 - l.x0) || 1;
      // 双栏论文里左右两栏的水平重叠很小，用左边缘距离再卡一道，
      // 否则一段正文会把另一栏也吞进来
      const leftAligned = Math.abs(l.x0 - b.x0) < medianH * 1.2;
      const sameColumn = overlap > minW * 0.3 && leftAligned;
      const near = gapY > -medianH * 0.8 && gapY < medianH * 1.1;
      if (sameColumn && near) {
        b.x0 = Math.min(b.x0, l.x0);
        b.y0 = Math.min(b.y0, l.y0);
        b.x1 = Math.max(b.x1, l.x1);
        b.y1 = Math.max(b.y1, l.y1);
        b.text += (b.text.endsWith('-') ? '' : '\n') + l.text;
        b.lines += 1;
        merged = true;
        break;
      }
    }
    if (!merged) {
      blocks.push({ x0: l.x0, y0: l.y0, x1: l.x1, y1: l.y1, text: l.text, lines: 1 });
    }
  }

  // 3) 分类 + 丢掉太碎的东西（页码、页眉这种单行小字仍然保留但会标出来）
  return blocks
    .filter((b) => b.x1 - b.x0 > 4 && b.y1 - b.y0 > 3)
    .map((b) => {
      const hRatio = (b.y1 - b.y0) / pageH;
      const isSingleShort = b.lines === 1 && b.text.trim().length <= 6;
      let kind: RegionKind = 'text';
      if (b.lines === 1 && (b.y1 - b.y0) > medianH * 1.5) kind = 'title';
      else if (isSingleShort && b.y1 / pageH < 0.1) kind = 'header';
      else if (isSingleShort && b.y0 / pageH > 0.9) kind = 'footer';
      else if (isSingleShort && hRatio < 0.02) kind = 'number';
      return toRegion(b, pageW, pageH, { kind, text: b.text.trim() });
    })
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

/** PP-DocLayout-S 的 23 类 → 我们关心的类别 */
export const LABEL_TO_KIND: Record<string, RegionKind> = {
  doc_title: 'title',
  paragraph_title: 'title',
  text: 'text',
  content: 'text',
  abstract: 'text',
  reference: 'text',
  aside_text: 'text',
  image: 'image',
  chart: 'image',
  header_image: 'image',
  footer_image: 'image',
  figure_title: 'caption',
  chart_title: 'caption',
  table: 'table',
  table_title: 'caption',
  formula: 'formula',
  formula_number: 'number',
  number: 'number',
  header: 'header',
  footer: 'footer',
  footnote: 'footer',
  seal: 'other',
  algorithm: 'text',
};

export const DOCLAYOUT_LABELS = [
  'paragraph_title',
  'image',
  'text',
  'number',
  'abstract',
  'content',
  'figure_title',
  'formula',
  'table',
  'table_title',
  'reference',
  'doc_title',
  'footnote',
  'header',
  'algorithm',
  'footer',
  'seal',
  'chart_title',
  'chart',
  'formula_number',
  'header_image',
  'footer_image',
  'aside_text',
];
