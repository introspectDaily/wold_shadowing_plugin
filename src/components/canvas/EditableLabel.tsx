import { useEffect, useRef, useState } from 'react';

interface Props {
  value: string;
  onChange: (next: string) => void;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  title?: string;
}

/** 双击变输入框的文本，页面标题 / 分区名 / 页面列表都用它 */
export function EditableLabel({
  value,
  onChange,
  className = '',
  inputClassName = '',
  placeholder = '未命名',
  title,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== value) onChange(next);
    else setDraft(value);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className={inputClassName || className}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          e.stopPropagation();
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setDraft(value);
            setEditing(false);
          }
        }}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <span
      className={className}
      title={title ?? '双击重命名'}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setDraft(value);
        setEditing(true);
      }}
    >
      {value || placeholder}
    </span>
  );
}
