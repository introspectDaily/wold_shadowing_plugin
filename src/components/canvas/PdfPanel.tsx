import { useCallback, useEffect, useRef, useState } from 'react';
import { analyzePage } from '../../lib/pdf/analyze';
import type { Region, RegionKind } from '../../lib/pdf/layout';
import {
  PAGE_SCALE,
  canvasToBlob,
  cropCanvas,
  openPdf,
  renderPage,
  type PdfHandle,
} from '../../lib/pdf/pdfDoc';
import { isLayoutModelAvailable } from '../../lib/pdf/paddleLayout';

export interface PdfCropPayload {
  blob: Blob;
  text: string;
  source: string;
  page: number;
  regionKind: RegionKind;
  width: number;
  height: number;
}

interface Props {
  onAddCrop: (payload: PdfCropPayload) => void;
  onClose: () => void;
  /** 从画布拖进来的 PDF（或外层指定的文件） */
  initialFile?: File | null;
  onFileConsumed?: () => void;
}

const KIND_LABEL: Record<RegionKind, string> = {
  title: '标题',
  text: '正文',
  image: '图片',
  caption: '图注',
  table: '表格',
  formula: '公式',
  header: '页眉',
  footer: '页脚',
  number: '页码',
  other: '其他',
};

interface DragRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** 右侧 PDF 面板：导入 → 自动/手动切块 → 丢到画布 */
export function PdfPanel({ onAddCrop, onClose, initialFile, onFileConsumed }: Props) {
  const [pdf, setPdf] = useState<PdfHandle | null>(null);
  const [fileName, setFileName] = useState('');
  const [pageNo, setPageNo] = useState(1);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'model' | 'text' | 'none' | ''>('');
  const [modelReady, setModelReady] = useState<boolean | null>(null);
  const [drag, setDrag] = useState<DragRect | null>(null);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void isLayoutModelAvailable().then(setModelReady);
  }, []);

  const analyze = useCallback(
    async (handle: PdfHandle, page: number, rendered: HTMLCanvasElement) => {
      setBusy(true);
      setStatus('分析版面…');
      try {
        const result = await analyzePage(handle, page, rendered);
        setRegions(result.regions);
        setMode(result.mode);
        setSelected(null);
        setStatus(
          result.mode === 'model'
            ? `布局模型切出 ${result.regions.length} 块`
            : result.mode === 'text'
              ? `文字层切出 ${result.regions.length} 块${result.modelError ? `（模型不可用：${result.modelError}）` : ''}`
              : `没切出区域，请手动框选${result.modelError ? `（模型不可用：${result.modelError}）` : ''}`,
        );
      } catch (err) {
        console.error(err);
        setStatus(`分析失败：${(err as Error).message}`);
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const goPage = useCallback(
    async (handle: PdfHandle, page: number) => {
      setBusy(true);
      try {
        const rendered = await renderPage(handle, page, PAGE_SCALE);
        setCanvas(rendered.canvas);
        setPageNo(page);
        await analyze(handle, page, rendered.canvas);
      } catch (err) {
        setStatus(`打开第 ${page} 页失败：${(err as Error).message}`);
      } finally {
        setBusy(false);
      }
    },
    [analyze],
  );

  const onFile = useCallback(
    async (file: File) => {
      setBusy(true);
      setStatus('读取 PDF…');
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const handle = await openPdf(bytes);
        setPdf(handle);
        setFileName(file.name);
        setRegions([]);
        setCanvas(null);
        await goPage(handle, 1);
      } catch (err) {
        setStatus(`读取失败：${(err as Error).message}`);
      } finally {
        setBusy(false);
      }
    },
    [goPage],
  );

  useEffect(() => {
    if (!initialFile) return;
    void onFile(initialFile).then(() => onFileConsumed?.());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFile]);

  /** 区域 → 画布：把那一块渲染成图片 + 带上文字 */
  const addRegion = useCallback(
    async (region: Region) => {
      if (!canvas) return;
      const cropped = cropCanvas(canvas, region);
      const blob = await canvasToBlob(cropped);
      onAddCrop({
        blob,
        text: region.text ?? '',
        source: fileName || 'PDF',
        page: pageNo,
        regionKind: region.kind,
        width: cropped.width,
        height: cropped.height,
      });
      setStatus(`已放到画布：${KIND_LABEL[region.kind]}（${Math.round(region.w * 100)}% 宽）`);
    },
    [canvas, fileName, onAddCrop, pageNo],
  );

  /* --------------------------- 手动框选 --------------------------- */
  const pointToNorm = (e: React.PointerEvent) => {
    const el = stageRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const p = pointToNorm(e);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = pointToNorm(e);
    setDrag({ ...drag, x1: p.x, y1: p.y });
  };

  const onPointerUp = () => {
    if (!drag) return;
    const x = Math.min(drag.x0, drag.x1);
    const y = Math.min(drag.y0, drag.y1);
    const w = Math.abs(drag.x1 - drag.x0);
    const h = Math.abs(drag.y1 - drag.y0);
    setDrag(null);
    if (w < 0.02 || h < 0.01) return;
    const manual: Region = { x, y, w, h, kind: 'other', source: 'manual', text: '' };
    setRegions((rs) => [...rs, manual]);
    setSelected(regions.length);
  };

  return (
    <aside className="cv-pdf">
      <header className="cv-pdf-head">
        <span className="cv-pdf-title">PDF 切块</span>
        <span className={`cv-pdf-model ${modelReady ? 'is-on' : 'is-off'}`} title={
          modelReady
            ? 'PP-DocLayout-S 布局模型已就绪'
            : '未找到布局模型：pnpm fetch:model 下载后可切出图片/表格区域'
        }>
          {modelReady ? '布局模型已就绪' : '文字块模式'}
        </span>
        <button type="button" className="cv-icon-btn" title="关闭" onClick={onClose}>
          ✕
        </button>
      </header>

      <div className="cv-pdf-actions">
        <button type="button" className="cv-btn" onClick={() => fileRef.current?.click()} disabled={busy}>
          选择 PDF
        </button>
        {pdf && (
          <>
            <button
              type="button"
              className="cv-btn cv-btn--icon"
              title="上一页"
              disabled={busy || pageNo <= 1}
              onClick={() => void goPage(pdf, pageNo - 1)}
            >
              ←
            </button>
            <span className="cv-pdf-pageno">
              {pageNo} / {pdf.pageCount}
            </span>
            <button
              type="button"
              className="cv-btn cv-btn--icon"
              title="下一页"
              disabled={busy || pageNo >= pdf.pageCount}
              onClick={() => void goPage(pdf, pageNo + 1)}
            >
              →
            </button>
            <button
              type="button"
              className="cv-btn"
              disabled={busy || !canvas}
              onClick={() => canvas && void analyze(pdf, pageNo, canvas)}
            >
              重新分析
            </button>
          </>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
            e.target.value = '';
          }}
        />
      </div>

      {!pdf && (
        <div
          className="cv-pdf-empty"
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('Files')) e.preventDefault();
          }}
          onDrop={(e) => {
            const f = Array.from(e.dataTransfer.files).find(
              (x) => x.type === 'application/pdf' || x.name.toLowerCase().endsWith('.pdf'),
            );
            if (!f) return;
            e.preventDefault();
            void onFile(f);
          }}
        >
          <div className="cv-pdf-empty__title">把 PDF 拖到这里</div>
          <div className="cv-pdf-empty__line">或者点上面的「选择 PDF」</div>
          <div className="cv-pdf-empty__line">自动按版面切块，点「＋」放到画布</div>
          <div className="cv-pdf-empty__line">也可以在页面上直接拖出选框，人工切</div>
        </div>
      )}

      {pdf && (
        <div className="cv-pdf-stagewrap">
          <div
            ref={stageRef}
            className="cv-pdf-stage"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            {canvas && (
              <img className="cv-pdf-page" src={canvas.toDataURL('image/png')} alt={`第 ${pageNo} 页`} draggable={false} />
            )}
            {regions.map((r, i) => (
              <div
                key={`${r.source}-${i}`}
                className={`cv-pdf-region cv-pdf-region--${r.kind} ${selected === i ? 'is-selected' : ''}`}
                style={{
                  left: `${r.x * 100}%`,
                  top: `${r.y * 100}%`,
                  width: `${r.w * 100}%`,
                  height: `${r.h * 100}%`,
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setSelected(i)}
                title={r.text?.slice(0, 120) || KIND_LABEL[r.kind]}
              >
                <button
                  type="button"
                  className="cv-pdf-add"
                  title="放到画布"
                  onClick={(e) => {
                    e.stopPropagation();
                    void addRegion(r);
                  }}
                >
                  ＋
                </button>
              </div>
            ))}
            {drag && (
              <div
                className="cv-pdf-marquee"
                style={{
                  left: `${Math.min(drag.x0, drag.x1) * 100}%`,
                  top: `${Math.min(drag.y0, drag.y1) * 100}%`,
                  width: `${Math.abs(drag.x1 - drag.x0) * 100}%`,
                  height: `${Math.abs(drag.y1 - drag.y0) * 100}%`,
                }}
              />
            )}
          </div>
        </div>
      )}

      {status && <div className="cv-pdf-status">{busy ? '⏳ ' : ''}{status}</div>}

      {regions.length > 0 && (
        <div className="cv-pdf-list">
          <div className="cv-pdf-list__head">
            区域 · {mode === 'model' ? '布局模型' : mode === 'text' ? '文字层' : '混合'}
          </div>
          {regions.map((r, i) => (
            <div
              key={`l-${i}`}
              className={`cv-pdf-item ${selected === i ? 'is-selected' : ''}`}
              onClick={() => setSelected(i)}
            >
              <span className="cv-pdf-item__kind">{KIND_LABEL[r.kind]}</span>
              <span className="cv-pdf-item__text">{r.text?.slice(0, 60) || '（无文字）'}</span>
              <button
                type="button"
                className="cv-pdf-item__add"
                title="放到画布"
                onClick={(e) => {
                  e.stopPropagation();
                  void addRegion(r);
                }}
              >
                ＋
              </button>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
