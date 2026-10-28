/**
 * 对齐吸附的纯逻辑（不依赖 React / React Flow，方便单测）。
 *
 * 拖拽时把被拖节点的「左/中/右」和「上/中/下」分别与其他节点比较，
 * 取最近且在阈值内的一条作为吸附目标。
 */
import type { CanvasNode } from './types';

export const ALIGN_THRESHOLD = 6;

export interface Guides {
  vertical?: number;
  horizontal?: number;
}

export interface HelperResult {
  guides: Guides;
  snapX?: number;
  snapY?: number;
}

export function getHelperLines(
  dragged: CanvasNode,
  nodes: CanvasNode[],
  threshold = ALIGN_THRESHOLD,
): HelperResult {
  const dw = dragged.width ?? 200;
  const dh = dragged.height ?? 100;
  const dX = dragged.position.x;
  const dY = dragged.position.y;
  const dLeft = dX;
  const dCenterX = dX + dw / 2;
  const dRight = dX + dw;
  const dTop = dY;
  const dCenterY = dY + dh / 2;
  const dBottom = dY + dh;

  let bestV = threshold;
  let bestH = threshold;
  let vertical: number | undefined;
  let horizontal: number | undefined;
  let snapX: number | undefined;
  let snapY: number | undefined;

  for (const n of nodes) {
    if (n.id === dragged.id) continue;
    const w = n.width ?? 200;
    const h = n.height ?? 100;
    const left = n.position.x;
    const centerX = n.position.x + w / 2;
    const right = n.position.x + w;
    const top = n.position.y;
    const centerY = n.position.y + h / 2;
    const bottom = n.position.y + h;

    const xPairs: [number, number][] = [
      [left, dLeft],
      [left, dCenterX],
      [left, dRight],
      [centerX, dLeft],
      [centerX, dCenterX],
      [centerX, dRight],
      [right, dLeft],
      [right, dCenterX],
      [right, dRight],
    ];
    for (const [target, current] of xPairs) {
      const diff = Math.abs(target - current);
      if (diff < bestV) {
        bestV = diff;
        vertical = target;
        snapX = dX + (target - current);
      }
    }

    const yPairs: [number, number][] = [
      [top, dTop],
      [top, dCenterY],
      [top, dBottom],
      [centerY, dTop],
      [centerY, dCenterY],
      [centerY, dBottom],
      [bottom, dTop],
      [bottom, dCenterY],
      [bottom, dBottom],
    ];
    for (const [target, current] of yPairs) {
      const diff = Math.abs(target - current);
      if (diff < bestH) {
        bestH = diff;
        horizontal = target;
        snapY = dY + (target - current);
      }
    }
  }

  return { guides: { vertical, horizontal }, snapX, snapY };
}
