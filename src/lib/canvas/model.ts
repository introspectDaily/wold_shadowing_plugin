/**
 * 画布笔记的工厂函数与默认值：所有「新建」都从这里出来，
 * 这样默认尺寸、默认文案只有一处定义。
 */
import { uid } from '../ids';
import { textToHtml } from './sanitize';
import type { CanvasNode, Notebook, NoteKind, Page, Section } from './types';

export function newNotebook(title = '我的笔记本'): Notebook {
  const now = Date.now();
  return { id: uid('nb-'), title, createdAt: now, updatedAt: now };
}

export function newSection(notebookId: string, title = '未命名分区'): Section {
  const now = Date.now();
  return { id: uid('sec-'), notebookId, title, createdAt: now, updatedAt: now };
}

export function newPage(sectionId: string, title = '无标题页'): Page {
  const now = Date.now();
  return { id: uid('page-'), sectionId, title, createdAt: now, updatedAt: now };
}

const NOTE_DEFAULTS: Record<NoteKind, { w: number; h: number; text: string }> = {
  note: { w: 280, h: 160, text: '' },
  heading: { w: 360, h: 72, text: '标题' },
  todo: { w: 280, h: 120, text: '' },
};

export function newTextNode(
  kind: NoteKind,
  position: { x: number; y: number },
  zIndex: number,
): CanvasNode {
  const d = NOTE_DEFAULTS[kind];
  return {
    id: uid('n-'),
    type: 'note',
    position,
    width: d.w,
    height: d.h,
    zIndex,
    data: {
      kind,
      html: d.text ? textToHtml(d.text) : '',
      text: d.text,
      color: 'default',
      checked: false,
    },
  };
}

export function newImageNode(
  assetId: string,
  position: { x: number; y: number },
  size: { width: number; height: number },
  zIndex: number,
): CanvasNode {
  return {
    id: uid('n-'),
    type: 'image',
    position,
    width: Math.round(size.width) || 320,
    height: Math.round(size.height) || 220,
    zIndex,
    data: { kind: 'image', assetId, alt: '' },
  };
}

/** 新建节点时的层级：永远压在最上面 */
export function nextZIndex(nodes: CanvasNode[]): number {
  return nodes.reduce((max, n) => Math.max(max, n.zIndex ?? 0), 0) + 1;
}

/**
 * 找一个不和已有节点重叠的落点。
 * 顺序往右下挪，最多找 60 次；实在找不到就接受重叠（节点特别密时）。
 */
export function findFreePosition(
  desired: { x: number; y: number },
  size: { width: number; height: number },
  nodes: CanvasNode[],
  gap = 20,
): { x: number; y: number } {
  const hits = (p: { x: number; y: number }) =>
    nodes.some((n) => {
      const w = n.width ?? 280;
      const h = n.height ?? 160;
      return (
        p.x < n.position.x + w + gap &&
        p.x + size.width + gap > n.position.x &&
        p.y < n.position.y + h + gap &&
        p.y + size.height + gap > n.position.y
      );
    });

  let p = { ...desired };
  for (let i = 0; i < 60; i++) {
    if (!hits(p)) return p;
    p = { x: p.x + 32, y: p.y + 32 };
  }
  return p;
}
