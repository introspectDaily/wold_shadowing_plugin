/**
 * 无限画布笔记：数据模型
 *
 * 设计原则：node 的 data 是可扩展的联合类型，后续接入
 * `ink`（笔迹）/ `pdf-crop`（PDF 裁切块）/ `ocr-text`（版面分析结果）
 * 时只需新增一种 data 类型和对应的渲染组件，不动画布内核。
 */
import type { Node } from '@xyflow/react';

/** 文本类节点的形态 */
export type NoteKind = 'note' | 'heading' | 'todo';

/** 便签配色 */
export type NoteColor =
  | 'default'
  | 'yellow'
  | 'blue'
  | 'green'
  | 'pink'
  | 'purple';

export const NOTE_COLORS: { value: NoteColor; label: string }[] = [
  { value: 'default', label: '默认' },
  { value: 'yellow', label: '黄' },
  { value: 'blue', label: '蓝' },
  { value: 'green', label: '绿' },
  { value: 'pink', label: '粉' },
  { value: 'purple', label: '紫' },
];

export interface NoteData extends Record<string, unknown> {
  kind: NoteKind;
  /** 富文本 HTML（已过白名单清洗） */
  html: string;
  /** 纯文本，用于空内容判断 / 后续全文搜索 */
  text: string;
  color: NoteColor;
  /** 仅 todo 使用 */
  checked: boolean;
}

export interface ImageData extends Record<string, unknown> {
  kind: 'image';
  /** 指向 `assets` store 里的二进制 */
  assetId: string;
  alt: string;
}

/** PDF 裁切块：图片是页面区域截图，text 是该区域的文字（数字版 PDF 直接就有） */
export interface PdfCropData extends Record<string, unknown> {
  kind: 'pdf-crop';
  assetId: string;
  text: string;
  source: string;
  page: number;
  regionKind: string;
  /** 文字区是否展开：要在刷新后保持原样，否则节点会变成一个「空壳大图」 */
  textOpen?: boolean;
  /** PDF 里的原始字号（pt）：展开的文字要和图片里的字一样大，靠它换算 */
  fontSize?: number;
  /** 裁切图在 PAGE_SCALE 下的像素宽（即区块的「原始」CSS 宽度），用做字号的缩放基准 */
  renderWidth?: number;
  /** 手动字号的微调倍率（侧栏的 A− / A+） */
  fontScale?: number;
}

export type CanvasNodeData = NoteData | ImageData | PdfCropData;

export type CanvasNode = Node<CanvasNodeData, 'note' | 'image' | 'pdf-crop'>;

export interface Notebook {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface Section {
  id: string;
  notebookId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface Page {
  id: string;
  sectionId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  /** 手动拖拽排序用；没有时回退到 createdAt */
  order?: number;
  /** 上次离开时的视口，用于回到这一页时恢复位置 */
  viewport?: Viewport;
}

export interface PageNodes {
  pageId: string;
  nodes: CanvasNode[];
  updatedAt: number;
}

export interface Asset {
  id: string;
  blob: Blob;
  type: string;
  createdAt: number;
}
