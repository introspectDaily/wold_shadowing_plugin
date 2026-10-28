import { describe, expect, it } from 'vitest';
import { getHelperLines } from '../alignment';
import type { CanvasNode } from '../types';

const node = (
  id: string,
  x: number,
  y: number,
  width = 200,
  height = 100,
): CanvasNode => ({
  id,
  type: 'note',
  position: { x, y },
  width,
  height,
  data: { kind: 'note', html: '', text: '', color: 'default', checked: false },
});

describe('getHelperLines', () => {
  it('左边缘接近时吸附并对齐左边', () => {
    const other = node('a', 100, 100);
    const dragged = node('b', 104, 400); // 差 4px，在阈值内
    const r = getHelperLines(dragged, [other, dragged]);
    expect(r.guides.vertical).toBe(100);
    expect(r.snapX).toBe(100);
  });

  it('右边贴着别人的左边也能吸附', () => {
    const other = node('a', 100, 100, 200, 100); // left 100 / center 200 / right 300
    const dragged = node('b', 298, 400, 100, 100); // left 298，差 2px 贴住 other.right
    const r = getHelperLines(dragged, [other, dragged]);
    expect(r.guides.vertical).toBe(300);
    expect(r.snapX).toBe(300);
  });

  it('超出阈值不吸附', () => {
    const other = node('a', 100, 100);
    const dragged = node('b', 120, 400);
    const r = getHelperLines(dragged, [other, dragged]);
    expect(r.guides.vertical).toBeUndefined();
    expect(r.snapX).toBeUndefined();
  });

  it('上下方向同理', () => {
    const other = node('a', 100, 100);
    const dragged = node('b', 600, 103);
    const r = getHelperLines(dragged, [other, dragged]);
    expect(r.guides.horizontal).toBe(100);
    expect(r.snapY).toBe(100);
  });

  it('不会和自己对齐', () => {
    const dragged = node('b', 100, 100);
    const r = getHelperLines(dragged, [dragged]);
    expect(r.guides.vertical).toBeUndefined();
    expect(r.guides.horizontal).toBeUndefined();
  });

  it('多个候选取最近的一条', () => {
    const near = node('a', 100, 0);
    const far = node('b', 103, 500);
    const dragged = node('c', 102, 900);
    const r = getHelperLines(dragged, [near, far, dragged]);
    expect(r.guides.vertical).toBe(103);
    expect(r.snapX).toBe(103);
  });
});
