import { EditableLabel } from './EditableLabel';
import type { Section } from '../../lib/canvas/types';

interface Props {
  sections: Section[];
  sectionId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, title: string) => void;
  onRemove: (id: string) => void;
}

/** OneNote 式分区标签栏：贴在画布上方 */
export function SectionTabs({ sections, sectionId, onSelect, onCreate, onRename, onRemove }: Props) {
  return (
    <div className="cv-tabs">
      {sections.map((s) => (
        <div
          key={s.id}
          className={`cv-tab ${s.id === sectionId ? 'active' : ''}`}
          onClick={() => onSelect(s.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSelect(s.id);
          }}
          role="button"
          tabIndex={0}
        >
          <EditableLabel
            value={s.title}
            onChange={(title) => onRename(s.id, title)}
            className="cv-tab-title"
            inputClassName="cv-tab-title-input"
          />
          {sections.length > 1 && s.id === sectionId && (
            <button
              type="button"
              className="cv-tab-del"
              title="删除分区"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`删除分区「${s.title}」及其全部页面？`)) onRemove(s.id);
              }}
            >
              ✕
            </button>
          )}
        </div>
      ))}
      <button type="button" className="cv-tab-add" title="新建分区" onClick={onCreate}>
        ＋
      </button>
    </div>
  );
}
