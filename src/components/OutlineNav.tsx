import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

export interface OutlineItem {
  /** 目标元素 id，用于滚动定位 */
  id: string;
  /** 显示文本 */
  label: string;
  /** 次级文本（可选，如音标符号） */
  hint?: string;
}

interface OutlineNavProps {
  items: OutlineItem[];
  /** 定位到目标 */
  onNavigate: (id: string) => void;
}

/** 右侧大纲导航：支持固定（展开）与收起（仅显示一个小把手） */
export function OutlineNav({ items, onNavigate }: OutlineNavProps) {
  const [pinned, setPinned] = useState(false);
  const [hoverOpen, setHoverOpen] = useState(false);
  // 未固定时，悬停临时展开；移开即收起
  const expanded = pinned || hoverOpen;
  const listRef = useRef<HTMLUListElement>(null);

  // 固定时隐藏悬停展开状态
  useEffect(() => {
    if (pinned) setHoverOpen(false);
  }, [pinned]);

  const go = (id: string) => {
    onNavigate(id);
    if (!pinned) setHoverOpen(false);
  };

  return (
    <div
      className={`outline-nav ${expanded ? 'expanded' : 'collapsed'} ${pinned ? 'pinned' : ''}`}
      onMouseEnter={() => !pinned && setHoverOpen(true)}
      onMouseLeave={() => !pinned && setHoverOpen(false)}
    >
      {expanded ? (
        <div className="outline-body">
          <div className="outline-head">
            <span className="outline-title">
              <Icon name="book" size={13} />
              大纲
            </span>
            <button
              type="button"
              className={`icon-btn ${pinned ? 'active' : ''}`}
              onClick={() => setPinned((p) => !p)}
              title={pinned ? '取消固定（收起）' : '固定大纲（保持展开）'}
            >
              <Icon name="pin" size={13} />
            </button>
          </div>
          <ul className="outline-list" ref={listRef}>
            {items.map((it) => (
              <li key={it.id}>
                <button type="button" className="outline-item" onClick={() => go(it.id)}>
                  <span className="outline-item-label">{it.label}</span>
                  {it.hint && <span className="outline-item-hint">{it.hint}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <button
          type="button"
          className="outline-handle"
          onClick={() => setPinned(true)}
          title="展开大纲"
        >
          <Icon name="book" size={14} />
          <span>大纲</span>
        </button>
      )}
    </div>
  );
}
