import { memo, useState } from 'react';
import { NodeResizer, type NodeProps } from '@xyflow/react';
import type { CanvasNode } from '../../lib/canvas/types';
import { useNodeActions } from './nodeActions';
import { useAssetUrl } from './useAssetUrl';

const KIND_LABEL: Record<string, string> = {
  title: '标题',
  text: '正文',
  image: '图片',
  caption: '图注',
  table: '表格',
  formula: '公式',
  header: '页眉',
  footer: '页脚',
  number: '页码',
  other: '裁切',
};

/**
 * PDF 裁切块。
 *
 * 展示策略：**图片是主角**，按页面渲染倍率 1:1 还原尺寸，保证文字可读；
 * 提取出来的文字默认收起（一行），点「文字」再展开 —— 否则正文占满节点，
 * 既看不清图也看不清字。
 */
export const PdfCropNodeView = memo(function PdfCropNodeView({
  id,
  data,
  selected,
}: NodeProps<CanvasNode>) {
  const assetId = data.kind === 'pdf-crop' ? data.assetId : '';
  const url = useAssetUrl(assetId);
  const actions = useNodeActions();
  const [showText, setShowText] = useState(false);

  if (data.kind !== 'pdf-crop') return null;

  const kindLabel = KIND_LABEL[data.regionKind] ?? '裁切';
  const hasText = data.text.trim().length > 0;

  return (
    <div className={`cv-node cv-node--pdf ${selected ? 'is-selected' : ''}`}>
      <NodeResizer
        isVisible={selected}
        minWidth={160}
        minHeight={80}
        lineClassName="cv-resize-line"
        handleClassName="cv-resize-handle"
      />
      <div className="cv-pdf-head">
        <span className="cv-pdf-badge">{kindLabel}</span>
        <span className="cv-pdf-meta" title={data.source}>
          P{data.page}
        </span>
        {hasText && (
          <button
            type="button"
            className={`cv-pdf-textbtn nodrag ${showText ? 'is-on' : ''}`}
            title={showText ? '收起文字' : '展开提取到的文字'}
            onClick={() => setShowText((v) => !v)}
          >
            文字
          </button>
        )}
        <button
          type="button"
          className="cv-pdf-del nodrag"
          title="删除"
          onClick={() => actions.remove(id)}
        >
          ×
        </button>
      </div>
      <div className="cv-pdf-body">
        {url ? (
          <img className="cv-pdf-img" src={url} alt={data.text.slice(0, 40)} draggable={false} />
        ) : (
          <div className="cv-image-loading">加载中…</div>
        )}
      </div>
      {showText && hasText && <div className="cv-pdf-text">{data.text}</div>}
    </div>
  );
});
