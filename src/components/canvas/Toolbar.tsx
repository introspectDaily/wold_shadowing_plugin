import { useReactFlow, useViewport } from '@xyflow/react';
import type { NoteKind, Page } from '../../lib/canvas/types';
import { EditableLabel } from './EditableLabel';

interface Props {
  page: Page;
  onRenamePage: (title: string) => void;
  onAddText: (kind: NoteKind) => void;
  onPickImage: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  pdfOpen: boolean;
  onTogglePdf: () => void;
}

export function Toolbar({
  page,
  onRenamePage,
  onAddText,
  onPickImage,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  pdfOpen,
  onTogglePdf,
}: Props) {
  const { fitView } = useReactFlow();
  const { zoom } = useViewport();

  return (
    <header className="cv-toolbar">
      <div className="cv-toolbar__title">
        <EditableLabel
          value={page.title}
          onChange={onRenamePage}
          className="cv-title-text"
          inputClassName="cv-title-input"
        />
      </div>

      <div className="cv-toolbar__tools">
        <button type="button" className="cv-btn" onClick={() => onAddText('note')}>
          ＋ 笔记
        </button>
        <button type="button" className="cv-btn" onClick={() => onAddText('heading')}>
          标题
        </button>
        <button type="button" className="cv-btn" onClick={() => onAddText('todo')}>
          待办
        </button>
        <button type="button" className="cv-btn" onClick={onPickImage}>
          图片
        </button>
        <button
          type="button"
          className={`cv-btn ${pdfOpen ? 'is-active' : ''}`}
          onClick={onTogglePdf}
        >
          PDF
        </button>

        <span className="cv-sep" />

        <button
          type="button"
          className="cv-btn cv-btn--icon"
          title="撤销 (Ctrl/Cmd+Z)"
          disabled={!canUndo}
          onClick={onUndo}
        >
          ↶
        </button>
        <button
          type="button"
          className="cv-btn cv-btn--icon"
          title="重做 (Ctrl/Cmd+Shift+Z)"
          disabled={!canRedo}
          onClick={onRedo}
        >
          ↷
        </button>

        <span className="cv-sep" />

        <button
          type="button"
          className="cv-btn cv-btn--icon"
          title="适应画布"
          onClick={() => void fitView({ padding: 0.3, duration: 250 })}
        >
          ⤢
        </button>
        <span className="cv-zoom">{Math.round(zoom * 100)}%</span>
      </div>
    </header>
  );
}
