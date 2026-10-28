import { useCallback, useRef, useState } from 'react';
import { useViewport, ViewportPortal, type OnNodeDrag } from '@xyflow/react';
import { getHelperLines, type Guides } from '../../lib/canvas/alignment';
import type { CanvasNode } from '../../lib/canvas/types';

/** 把辅助线画在画布坐标系里，缩放平移自动跟随 */
export function HelperLines({ guides }: { guides: Guides }) {
  const { zoom } = useViewport();
  const stroke = 1 / zoom;
  const span = 40000;

  return (
    <ViewportPortal>
      {guides.vertical !== undefined && (
        <div
          data-guide="v"
          style={{
            position: 'absolute',
            left: guides.vertical,
            top: -span,
            width: stroke,
            height: span * 2,
            background: '#4f46e5',
            opacity: 0.55,
            pointerEvents: 'none',
          }}
        />
      )}
      {guides.horizontal !== undefined && (
        <div
          data-guide="h"
          style={{
            position: 'absolute',
            left: -span,
            top: guides.horizontal,
            height: stroke,
            width: span * 2,
            background: '#4f46e5',
            opacity: 0.55,
            pointerEvents: 'none',
          }}
        />
      )}
    </ViewportPortal>
  );
}

export function useHelperLines(
  setNodes: (updater: (nodes: CanvasNode[]) => CanvasNode[]) => void,
  nodesRef: React.RefObject<CanvasNode[]>,
) {
  const [guides, setGuides] = useState<Guides>({});

  const onNodeDrag: OnNodeDrag<CanvasNode> = useCallback(
    (_event, node) => {
      const { guides: next, snapX, snapY } = getHelperLines(node, nodesRef.current ?? []);
      setGuides(next);

      if (snapX !== undefined || snapY !== undefined) {
        setNodes((ns) =>
          ns.map((n) =>
            n.id === node.id
              ? { ...n, position: { x: snapX ?? n.position.x, y: snapY ?? n.position.y } }
              : n,
          ),
        );
      }
    },
    [nodesRef, setNodes],
  );

  const onNodeDragStop = useCallback(() => setGuides({}), []);

  return { guides, onNodeDrag, onNodeDragStop };
}
