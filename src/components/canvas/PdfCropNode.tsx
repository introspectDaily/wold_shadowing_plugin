import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { NodeResizer, type NodeProps } from '@xyflow/react';
import type { CanvasNode } from '../../lib/canvas/types';
import { PAGE_SCALE } from '../../lib/pdf/pdfDoc';
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

/** 侧栏宽度：展开文字时节点往右长这么多，图片宽度不变，字号也就没变 */
const PANEL_WIDTH = 340;
const MIN_WIDTH = 180;
const MAX_WIDTH = 1800;
const MIN_HEIGHT = 90;
const FONT_MIN = 8;
const FONT_MAX = 40;
/** 没有 PDF 原始字号时（OCR / 手动画的框）用这个兜底 */
const FONT_FALLBACK = 13;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** 收起状态下的单行摘要：把换行压成空格，避免摘要只剩空白 */
function toPreview(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * PDF 裁切块。
 *
 * 展示策略：**图片是主角**，按 1:1 还原尺寸保证清晰；文字**向右展开成侧栏**，
 * 不占图片的空间，字号还跟着图片一起缩 —— 读起来跟直接看原页面一样。
 *
 * - 收起：底部一行摘要（省略号），点一下展开侧栏
 * - 展开：节点往右长 PANEL_WIDTH，图片宽高不变；文字按 `fontSize × 图片缩放比` 渲染，
 *   所以图片拉大 → 字跟着变大，跟图里的字一样大
 * - 侧栏顶部：A− / A+ 微调字号（存 `data.fontScale`）、复制全文
 * - 缩放：拖节点边角，或 **Alt+滚轮** 等比缩放（字号自动跟随）
 */
export const PdfCropNodeView = memo(function PdfCropNodeView({
  id,
  data,
  selected,
  width,
  height,
}: NodeProps<CanvasNode>) {
  const crop = data.kind === 'pdf-crop' ? data : null;
  const assetId = crop?.assetId ?? '';
  const url = useAssetUrl(assetId);
  const actions = useNodeActions();
  const [showText, setShowText] = useState(!!crop?.textOpen);
  const [copied, setCopied] = useState(false);
  /** 图片区的实际显示宽度：字号 = PDF 原字号 × (显示宽 / 原始宽) */
  const [imageWidth, setImageWidth] = useState(0);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLDivElement | null>(null);
  const sizeRef = useRef({ width: 0, height: 0 });
  sizeRef.current = { width: width ?? 0, height: height ?? 0 };

  const text = (crop?.text ?? '').trim();
  const hasText = text.length > 0;
  const preview = toPreview(text);

  /* ------------------------ 展开 / 收起：只动宽度 ------------------------ */
  const toggleText = useCallback(() => {
    setCopied(false);
    const current = sizeRef.current.width || rootRef.current?.offsetWidth || 0;
    if (showText) {
      const next = Math.round(current - PANEL_WIDTH);
      if (next >= MIN_WIDTH) actions.resize(id, { width: next });
      setShowText(false);
      actions.updateData(id, { textOpen: false });
      return;
    }
    // 往右长——图片在左、文字在右，图片宽度不变，字号就不会跳
    if (current > 0) actions.resize(id, { width: Math.round(current + PANEL_WIDTH) });
    setShowText(true);
    actions.updateData(id, { textOpen: true });
  }, [actions, id, showText]);

  /* ---------------------------- 图片宽度跟踪 ---------------------------- */
  useEffect(() => {
    const el = bodyRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0]?.contentRect.width ?? 0);
      if (w > 0) setImageWidth((prev) => (Math.abs(prev - w) > 1 ? w : prev));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasText]);

  /* --------------------- Alt+滚轮：等比缩放整个节点 --------------------- */
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.altKey) return; // 不按 Alt 就交给画布：平移 / 缩放画布
      e.preventDefault();
      e.stopPropagation();
      const { width: w, height: h } = sizeRef.current;
      if (!w || !h) return;
      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      const nextW = clamp(Math.round(w * factor), MIN_WIDTH, MAX_WIDTH);
      if (nextW === w) return;
      const nextH = clamp(Math.round((h * nextW) / w), MIN_HEIGHT, 4000);
      actions.resize(id, { width: nextW, height: nextH });
    };
    // React 的 onWheel 是 passive 的，拦不住画布缩放，只能自己挂原生监听
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [actions, id]);

  /* ------------------------------ 字号 ------------------------------ */
  // 裁切图在 PAGE_SCALE 下的宽度 = 区块的「原始」CSS 宽度；图片显示宽 / 原始宽 = 当前缩放比
  const naturalWidth = crop?.renderWidth ? crop.renderWidth / PAGE_SCALE : 0;
  const imageScale = naturalWidth > 0 && imageWidth > 0 ? imageWidth / naturalWidth : 1;
  const fontPx =
    Math.round(
      clamp((crop?.fontSize ?? FONT_FALLBACK) * imageScale * (crop?.fontScale ?? 1), FONT_MIN, FONT_MAX) * 2,
    ) / 2;

  const bumpFont = useCallback(
    (factor: number) => {
      const next = clamp((crop?.fontScale ?? 1) * factor, 0.5, 3);
      actions.updateData(id, { fontScale: Math.round(next * 100) / 100 });
    },
    [actions, crop?.fontScale, id],
  );

  const copyText = useCallback(() => {
    void navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      },
      () => setCopied(false),
    );
  }, [text]);

  if (!crop) return null;

  const kindLabel = KIND_LABEL[crop.regionKind] ?? '裁切';

  return (
    <div
      ref={rootRef}
      className={`cv-node cv-node--pdf ${selected ? 'is-selected' : ''} ${showText ? 'is-text-open' : ''}`}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={showText ? PANEL_WIDTH + MIN_WIDTH : MIN_WIDTH}
        minHeight={MIN_HEIGHT}
        lineClassName="cv-resize-line"
        handleClassName="cv-resize-handle"
      />
      <div className="cv-pdf-head">
        <span className="cv-pdf-badge">{kindLabel}</span>
        <span className="cv-pdf-meta" title={crop.source}>
          P{crop.page}
        </span>
        {hasText && (
          <button
            type="button"
            className={`cv-pdf-textbtn nodrag ${showText ? 'is-on' : ''}`}
            title={showText ? '收起文字侧栏，图片回到原宽度' : `在右侧展开全文（${text.length} 字）`}
            onClick={toggleText}
          >
            {showText ? '收起' : '文字'}
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
      <div className="cv-pdf-main">
        <div className="cv-pdf-body" ref={bodyRef} title="Alt+滚轮缩放这个块">
          {url ? (
            <img className="cv-pdf-img" src={url} alt={preview.slice(0, 40)} draggable={false} />
          ) : (
            <div className="cv-image-loading">加载中…</div>
          )}
        </div>
        {hasText && showText && (
          <div className="cv-pdf-side">
            <div className="cv-pdf-side__bar">
              <button type="button" className="cv-pdf-side__btn nodrag" title="字号 −" onClick={() => bumpFont(0.9)}>
                A−
              </button>
              <span className="cv-pdf-side__size">{fontPx}px</span>
              <button type="button" className="cv-pdf-side__btn nodrag" title="字号 +" onClick={() => bumpFont(1.1)}>
                A+
              </button>
              <span className="cv-pdf-side__spacer" />
              <button
                type="button"
                className={`cv-pdf-side__btn nodrag ${copied ? 'is-on' : ''}`}
                title="复制全文"
                onClick={copyText}
              >
                {copied ? '已复制' : '复制'}
              </button>
            </div>
            <div className="cv-pdf-text" ref={textRef} style={{ fontSize: `${fontPx}px` }}>
              {text}
            </div>
          </div>
        )}
      </div>
      {hasText && !showText && (
        <button
          type="button"
          className="cv-pdf-snippet nodrag"
          title="点开在右侧看全文"
          onClick={toggleText}
        >
          <span className="cv-pdf-snippet__label">文</span>
          <span className="cv-pdf-snippet__text">{preview}</span>
        </button>
      )}
    </div>
  );
});
