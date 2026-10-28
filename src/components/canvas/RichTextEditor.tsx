import { useEffect, useRef } from 'react';
import { escapeHtml, htmlToText, sanitizeHtml } from '../../lib/canvas/sanitize';

interface Props {
  html: string;
  placeholder: string;
  /** 新建节点进入编辑时全选，敲键盘即替换 */
  selectAllOnMount?: boolean;
  /** 单行节点（标题）回车即结束编辑 */
  singleLine?: boolean;
  onChange: (html: string, text: string) => void;
  onExit: () => void;
  /** 失焦到这些元素上时不退出编辑（比如格式工具条） */
  shouldKeepFocus?: (next: Node | null) => boolean;
}

/**
 * 富文本编辑器：原生 contentEditable。
 *
 * 刻意做成**非受控**——受控地回写 innerHTML 会让光标每敲一个字就跳回开头，
 * 这是 contentEditable + React 的经典坑。所以只在挂载时灌一次内容，
 * 之后靠 onInput 往外抛，外部（撤销之类）改动时才同步回来。
 */
export function RichTextEditor({
  html,
  placeholder,
  selectAllOnMount = false,
  singleLine = false,
  onChange,
  onExit,
  shouldKeepFocus,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = html;
    el.focus();

    const range = document.createRange();
    range.selectNodeContents(el);
    if (!selectAllOnMount) range.collapse(false); // 光标落到末尾
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    // 只在挂载时执行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 撤销/重做会换掉节点对象，此时把内容同步回来（正在输入时不要动它）
  useEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    if (el.innerHTML !== html) el.innerHTML = html;
  }, [html]);

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    onChange(sanitizeHtml(el.innerHTML), htmlToText(el.innerHTML));
  };

  return (
    <div
      ref={ref}
      className="cv-rt"
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onInput={emit}
      onBlur={(e) => {
        const next = e.relatedTarget as Node | null;
        if (shouldKeepFocus?.(next)) {
          // 点到格式按钮上：把焦点抢回编辑器，编辑状态不中断
          ref.current?.focus();
          return;
        }
        emit();
        onExit();
      }}
      onPaste={(e) => {
        // 统一走白名单：粘进来的东西不进 DOM，先清洗再插入
        e.preventDefault();
        const rich = e.clipboardData.getData('text/html');
        const plain = e.clipboardData.getData('text/plain');
        const payload = rich
          ? sanitizeHtml(rich)
          : escapeHtml(plain).replace(/\n/g, '<br>');
        document.execCommand('insertHTML', false, payload);
        emit();
      }}
      onKeyDown={(e) => {
        if (e.nativeEvent.isComposing) return; // 中文输入法组合中不处理
        e.stopPropagation();
        if (e.key === 'Escape') {
          e.preventDefault();
          onExit();
          return;
        }
        if (e.key === 'Enter' && (singleLine || e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          onExit();
        }
      }}
    />
  );
}
