import { useRef, useState } from 'react';
import { EditableLabel } from './EditableLabel';
import type { Notebook, Page } from '../../lib/canvas/types';

interface Props {
  notebooks: Notebook[];
  notebookId: string | null;
  pages: Page[];
  pageId: string | null;
  onSelectNotebook: (id: string) => void;
  onCreateNotebook: () => void;
  onRenameNotebook: (id: string, title: string) => void;
  onRemoveNotebook: (id: string) => void;
  onSelectPage: (id: string) => void;
  onCreatePage: () => void;
  onRenamePage: (id: string, title: string) => void;
  onRemovePage: (id: string) => void;
  onReorderPages: (from: number, to: number) => void;
}

/** OneNote 式左栏：上面切笔记本，下面是这一分区里的页面列表 */
export function Sidebar({
  notebooks,
  notebookId,
  pages,
  pageId,
  onSelectNotebook,
  onCreateNotebook,
  onRenameNotebook,
  onRemoveNotebook,
  onSelectPage,
  onCreatePage,
  onRenamePage,
  onRemovePage,
  onReorderPages,
}: Props) {
  const current = notebooks.find((n) => n.id === notebookId) ?? null;
  const dragIndex = useRef<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  return (
    <aside className="cv-sidebar">
      <div className="cv-notebook">
        <select
          className="cv-notebook__select"
          value={notebookId ?? ''}
          onChange={(e) => onSelectNotebook(e.target.value)}
        >
          {notebooks.map((nb) => (
            <option key={nb.id} value={nb.id}>
              {nb.title}
            </option>
          ))}
        </select>
        <button type="button" className="cv-icon-btn" title="新建笔记本" onClick={onCreateNotebook}>
          ＋
        </button>
        <button
          type="button"
          className="cv-icon-btn"
          title="重命名笔记本"
          onClick={() => {
            if (!current) return;
            const title = window.prompt('笔记本名称', current.title);
            if (title && title.trim()) onRenameNotebook(current.id, title.trim());
          }}
        >
          ✎
        </button>
        <button
          type="button"
          className="cv-icon-btn cv-icon-btn--danger"
          title="删除笔记本"
          onClick={() => {
            if (!current) return;
            if (!window.confirm(`删除笔记本「${current.title}」及其全部页面？`)) return;
            onRemoveNotebook(current.id);
          }}
        >
          ✕
        </button>
      </div>

      <div className="cv-pages-head">
        <span>页面</span>
        <button type="button" className="cv-icon-btn" title="新建页面" onClick={onCreatePage}>
          ＋
        </button>
      </div>

      <ul className="cv-pages">
        {pages.map((p, i) => (
          <li
            key={p.id}
            draggable
            onDragStart={(e) => {
              dragIndex.current = i;
              e.dataTransfer.effectAllowed = 'move';
              // Firefox 需要设置数据才会真正开始拖拽
              e.dataTransfer.setData('text/plain', String(i));
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setDropIndex(i);
            }}
            onDragLeave={() => setDropIndex((d) => (d === i ? null : d))}
            onDrop={(e) => {
              e.preventDefault();
              const from = dragIndex.current;
              dragIndex.current = null;
              setDropIndex(null);
              if (from !== null && from !== i) onReorderPages(from, i);
            }}
            onDragEnd={() => {
              dragIndex.current = null;
              setDropIndex(null);
            }}
          >
            <div
              className={`cv-page-item ${p.id === pageId ? 'active' : ''} ${
                dropIndex === i ? 'is-drop-target' : ''
              }`}
              onClick={() => onSelectPage(p.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onSelectPage(p.id);
              }}
              role="button"
              tabIndex={0}
            >
              <span className="cv-page-index">{i + 1}</span>
              <EditableLabel
                value={p.title}
                onChange={(title) => onRenamePage(p.id, title)}
                className="cv-page-title"
                inputClassName="cv-page-title-input"
              />
              <button
                type="button"
                className="cv-page-del"
                title="删除页面"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`删除页面「${p.title}」？`)) onRemovePage(p.id);
                }}
              >
                ✕
              </button>
            </div>
          </li>
        ))}
        {pages.length === 0 && <li className="cv-pages-empty">还没有页面</li>}
      </ul>
    </aside>
  );
}
