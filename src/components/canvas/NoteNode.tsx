import { memo, useEffect, useRef, useState } from 'react';
import { NodeResizer, NodeToolbar, Position, type NodeProps } from '@xyflow/react';
import { NOTE_COLORS, type CanvasNode, type NoteColor } from '../../lib/canvas/types';
import { textToHtml } from '../../lib/canvas/sanitize';
import { useNodeActions } from './nodeActions';
import { RichTextEditor } from './RichTextEditor';

function colorOptions(current: NoteColor, onPick: (c: NoteColor) => void) {
  return NOTE_COLORS.map((c) => (
    <button
      type="button"
      key={c.value}
      title={c.label}
      className={`cv-swatch cv-swatch-${c.value} ${c.value === current ? 'is-active' : ''}`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onPick(c.value);
      }}
    />
  ));
}

/** 编辑态浮在上面的格式工具条 */
function FormatBar() {
  const cmd = (name: string, value?: string) => {
    document.execCommand(name, false, value);
  };
  const btn = (label: string, title: string, onClick: () => void, className = '') => (
    <button
      type="button"
      className={`cv-fmt-btn ${className}`}
      title={title}
      // 用 mousedown 阻止默认行为，保住 contentEditable 里的选区
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {label}
    </button>
  );

  return (
    <div className="cv-fmtbar nodrag" onPointerDown={(e) => e.stopPropagation()}>
      {btn('B', '加粗', () => cmd('bold'), 'is-bold')}
      {btn('I', '斜体', () => cmd('italic'), 'is-italic')}
      {btn('U', '下划线', () => cmd('underline'), 'is-underline')}
      {btn('S', '删除线', () => cmd('strikeThrough'), 'is-strike')}
      {btn('🖍', '高亮', () => cmd('hiliteColor', '#fff3a3'))}
      {btn('•', '无序列表', () => cmd('insertUnorderedList'))}
      {btn('1.', '有序列表', () => cmd('insertOrderedList'))}
      {btn('✕', '清除格式', () => cmd('removeFormat'))}
    </div>
  );
}

/**
 * 文本类节点（笔记 / 标题 / 待办）。
 *
 * 编辑态用的是**真实的 contentEditable**，不是 canvas 绘字：
 * 中文输入法、光标、选区、富文本粘贴都交给浏览器原生实现。
 */
export const NoteNodeView = memo(function NoteNodeView({
  id,
  data,
  selected,
}: NodeProps<CanvasNode>) {
  const actions = useNodeActions();
  const barRef = useRef<HTMLDivElement | null>(null);
  const [editing, setEditing] = useState(false);
  /** 刚新建就进入编辑：全选默认文字，一敲键盘就替换，而不是接在后面 */
  const [fresh, setFresh] = useState(false);

  const kind = data.kind === 'image' ? 'note' : data.kind;
  const html = data.kind === 'image' ? '' : data.html || textToHtml(data.text || '');
  const text = data.kind === 'image' ? '' : data.text;
  const color: NoteColor = data.kind === 'image' ? 'default' : data.color;
  const checked = data.kind === 'todo' ? data.checked : false;

  // 工具栏新建节点后，自动进入编辑态
  useEffect(() => {
    if (actions.editingId === id) {
      setFresh(true);
      setEditing(true);
      actions.endEdit();
    }
    // 只关心「谁被请求编辑」，不要把 actions 整体放进依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions.editingId, id]);

  const setContent = (nextHtml: string, nextText: string) => {
    actions.updateData(id, { html: nextHtml, text: nextText });
  };

  return (
    <div
      className={[
        'cv-node',
        `cv-node--${kind}`,
        `cv-color-${color}`,
        selected ? 'is-selected' : '',
        editing ? 'is-editing' : '',
        checked ? 'is-done' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <NodeResizer
        isVisible={selected && !editing}
        minWidth={120}
        minHeight={48}
        lineClassName="cv-resize-line"
        handleClassName="cv-resize-handle"
      />

      <NodeToolbar isVisible={selected} position={Position.Top} offset={8}>
        {editing && kind !== 'todo' ? (
          <div ref={barRef}>
            <FormatBar />
          </div>
        ) : (
          <div className="cv-node-toolbar">
            {colorOptions(color, (c) => actions.updateData(id, { color: c }))}
            <span className="cv-toolbar-sep" />
            <button
              type="button"
              className="cv-node-toolbar__icon"
              title="置顶"
              onClick={() => actions.bringToFront(id)}
            >
              ↑
            </button>
            <button
              type="button"
              className="cv-node-toolbar__icon"
              title="置底"
              onClick={() => actions.sendToBack(id)}
            >
              ↓
            </button>
            <button
              type="button"
              className="cv-node-toolbar__del"
              title="删除"
              onClick={() => actions.remove(id)}
            >
              删除
            </button>
          </div>
        )}
      </NodeToolbar>

      {kind === 'todo' && (
        <input
          type="checkbox"
          className="cv-todo-box nodrag"
          checked={checked}
          onPointerDown={(e) => e.stopPropagation()}
          onChange={(e) => actions.updateData(id, { checked: e.target.checked })}
        />
      )}

      {editing ? (
        <RichTextEditor
          html={html === '<br>' ? '' : html}
          placeholder={kind === 'heading' ? '标题…' : '输入笔记…'}
          selectAllOnMount={fresh}
          singleLine={kind === 'heading'}
          onChange={setContent}
          onExit={() => {
            setEditing(false);
            setFresh(false);
          }}
          shouldKeepFocus={(next) => !!next && !!barRef.current?.contains(next)}
        />
      ) : (
        <div
          className="cv-node-text"
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
        >
          {text ? (
            <div dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <span className="cv-node-placeholder">双击输入…</span>
          )}
        </div>
      )}
    </div>
  );
});
