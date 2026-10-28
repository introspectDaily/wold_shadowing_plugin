import { useEffect, useRef } from 'react';

export interface MenuItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  /** 分组之间的分隔线 */
  separator?: boolean;
  shortcut?: string;
}

interface Props {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

/** 画布上的右键菜单（空白处 / 节点上共用一套） */
export function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // 用 capture 保证画布先关菜单再处理自己的点击
    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('wheel', onClose, { passive: true });
    return () => {
      window.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('wheel', onClose);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="cv-menu"
      style={{ left: x, top: y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) =>
        item.separator ? (
          <div key={`sep-${i}`} className="cv-menu__sep" />
        ) : (
          <button
            key={item.label}
            type="button"
            className={`cv-menu__item ${item.danger ? 'is-danger' : ''}`}
            disabled={item.disabled}
            onClick={() => {
              item.onClick();
              onClose();
            }}
          >
            <span>{item.label}</span>
            {item.shortcut && <span className="cv-menu__key">{item.shortcut}</span>}
          </button>
        ),
      )}
    </div>
  );
}
