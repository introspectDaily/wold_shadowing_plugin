import { memo, useEffect, useRef, useState } from 'react';
import { NodeResizer, NodeToolbar, Position, type NodeProps } from '@xyflow/react';
import { NOTE_COLORS, type CanvasNode, type NoteColor } from '../../lib/canvas/types';
import { useNodeActions } from './nodeActions';

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

/**
 * 文本类节点（笔记 / 标题 / 待办）。
 *
 * 关键点：编辑态用的是**真实的 textarea**，不是 canvas 绘制文字。
 * 中文输入法、光标、选区、复制粘贴、撤销都交给浏览器原生实现。
 */
export const NoteNodeView = memo(function NoteNodeView({
  id,
  data,
  selected,
}: NodeProps<CanvasNode>) {
  const actions = useNodeActions();
  const [editing, setEditing] = useState(false);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  /** 刚新建就进入编辑：全选默认文字，一敲键盘就替换，而不是接在后面 */
  const freshRef = useRef(false);

  const kind = data.kind === 'image' ? 'note' : data.kind;
  const text = data.kind === 'image' ? '' : data.text;
  const color: NoteColor = data.kind === 'image' ? 'default' : data.color;
  const checked = data.kind === 'todo' ? data.checked : false;

  // 工具栏新建节点后，自动进入编辑态
  useEffect(() => {
    if (actions.editingId === id) {
      freshRef.current = true;
      setEditing(true);
      actions.endEdit();
    }
    // 只关心「谁被请求编辑」，不要把 actions 整体放进依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions.editingId, id]);

  useEffect(() => {
    if (!editing) return;
    const ta = taRef.current;
    if (!ta) return;
    ta.focus();
    if (freshRef.current) {
      ta.select();
      freshRef.current = false;
      return;
    }
    // 已有内容时把光标放到末尾，而不是全选（全选后一输入就把原文冲掉了）
    const end = ta.value.length;
    ta.setSelectionRange(end, end);
  }, [editing]);

  const commit = () => setEditing(false);

  const setText = (value: string) => actions.updateData(id, { text: value });

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

      <NodeToolbar isVisible={selected && !editing} position={Position.Top} offset={8}>
        <div className="cv-node-toolbar">
          {colorOptions(color, (c) => actions.updateData(id, { color: c }))}
          <button
            type="button"
            className="cv-node-toolbar__del"
            title="删除"
            onClick={() => actions.remove(id)}
          >
            删除
          </button>
        </div>
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
        <textarea
          ref={taRef}
          className="cv-node-input nodrag nowheel"
          value={text}
          placeholder={kind === 'heading' ? '标题…' : '输入笔记…'}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            // 输入法组合中不响应（中文拼音选词时按 Enter 不能提交）
            if (e.nativeEvent.isComposing) return;
            e.stopPropagation();
            if (e.key === 'Escape') {
              e.preventDefault();
              commit();
            } else if (e.key === 'Enter' && (kind === 'heading' || e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              commit();
            }
          }}
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
            text
          ) : (
            <span className="cv-node-placeholder">双击输入…</span>
          )}
        </div>
      )}
    </div>
  );
});
