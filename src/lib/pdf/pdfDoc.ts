/**
 * PDF 读取：渲染页面 + 取文字层。
 *
 * worker 用 Vite 的 `?url` 导入，会被打成扩展内的独立文件；
 * 绝不能指向 CDN —— 扩展的 CSP 不允许远程脚本。
 */
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { TextItem } from './layout';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/** 页面渲染倍率：裁切块按这个倍率还原到 1:1 显示尺寸，保证文字清晰 */
export const PAGE_SCALE = 2.5;

export interface PdfHandle {
  doc: pdfjs.PDFDocumentProxy;
  pageCount: number;
}

export async function openPdf(bytes: Uint8Array): Promise<PdfHandle> {
  const doc = await pdfjs.getDocument({ data: bytes }).promise;
  return { doc, pageCount: doc.numPages };
}

export interface RenderedPage {
  canvas: HTMLCanvasElement;
  /** CSS 像素尺寸 */
  width: number;
  height: number;
}

/** 把某一页渲染到 canvas（scale 是相对 72dpi 的倍数） */
export async function renderPage(
  pdf: PdfHandle,
  pageNumber: number,
  scale = 2,
): Promise<RenderedPage> {
  const page = await pdf.doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建 canvas 上下文');
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  return { canvas, width: canvas.width, height: canvas.height };
}

/** 取文字层，转成左上角原点的页面坐标（未缩放，单位 pt） */
export async function extractTextItems(
  pdf: PdfHandle,
  pageNumber: number,
): Promise<{ items: TextItem[]; pageWidth: number; pageHeight: number }> {
  const page = await pdf.doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const items: TextItem[] = [];

  for (const raw of content.items) {
    if (!('str' in raw)) continue;
    if (!raw.str.trim()) continue;
    const tx = pdfjs.Util.transform(viewport.transform, raw.transform);
    const fontHeight = Math.hypot(tx[2]!, tx[3]!) || Math.abs(raw.height) || 10;
    items.push({
      str: raw.str,
      x: tx[4]!,
      y: tx[5]! - fontHeight,
      w: raw.width,
      h: fontHeight,
    });
  }

  return { items, pageWidth: viewport.width, pageHeight: viewport.height };
}

/** 从已渲染的页面里裁一块出来 */
export function cropCanvas(source: HTMLCanvasElement, box: { x: number; y: number; w: number; h: number }): HTMLCanvasElement {
  const sx = Math.round(box.x * source.width);
  const sy = Math.round(box.y * source.height);
  const sw = Math.max(1, Math.round(box.w * source.width));
  const sh = Math.max(1, Math.round(box.h * source.height));
  const out = document.createElement('canvas');
  out.width = sw;
  out.height = sh;
  out.getContext('2d')?.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
  return out;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('导出图片失败'))),
      'image/png',
    );
  });
}
