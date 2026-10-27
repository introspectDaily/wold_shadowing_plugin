import { memo } from 'react';
import { NodeResizer, type NodeProps } from '@xyflow/react';
import type { CanvasNode } from '../../lib/canvas/types';
import { useNodeActions } from './nodeActions';
import { useAssetUrl } from './useAssetUrl';

/**
 * 图片节点。
 *
 * 这一层是后面 PDF 裁切块的预演：binary 走 `assets` store，
 * 节点只存 assetId + 位置尺寸，所以换成一个 PDF 裁切区域
 * 只是「多存一组裁切参数」的事。
 */
export const ImageNodeView = memo(function ImageNodeView({
  id,
  data,
  selected,
}: NodeProps<CanvasNode>) {
  const url = useAssetUrl(data.kind === 'image' ? data.assetId : '');
  const actions = useNodeActions();

  if (data.kind !== 'image') return null;

  return (
    <div className={`cv-node cv-node--image ${selected ? 'is-selected' : ''}`}>
      <NodeResizer
        isVisible={selected}
        minWidth={80}
        minHeight={60}
        keepAspectRatio={false}
        lineClassName="cv-resize-line"
        handleClassName="cv-resize-handle"
      />
      {url ? (
        <img className="cv-image" src={url} alt={data.alt} draggable={false} />
      ) : (
        <div className="cv-image-loading">加载中…</div>
      )}
      <button
        type="button"
        className="cv-image-del nodrag"
        title="删除"
        onClick={() => actions.remove(id)}
      >
        ×
      </button>
    </div>
  );
});
