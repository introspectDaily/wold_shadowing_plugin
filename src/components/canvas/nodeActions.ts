/**
 * 节点内部要用的动作，用 context 下发。
 * 这样 NoteNode / ImageNode 不需要知道画布怎么存盘、历史怎么记。
 */
import { createContext, useContext } from 'react';
import type { CanvasNodeData } from '../../lib/canvas/types';

export interface NodeActions {
  updateData(id: string, patch: Partial<CanvasNodeData>): void;
  remove(id: string): void;
  bringToFront(id: string): void;
  sendToBack(id: string): void;
  /** 正在被「工具栏新建」请求进入编辑态的节点 id */
  editingId: string | null;
  beginEdit(id: string): void;
  endEdit(): void;
}

export const NodeActionsContext = createContext<NodeActions | null>(null);

export function useNodeActions(): NodeActions {
  const ctx = useContext(NodeActionsContext);
  if (!ctx) throw new Error('NodeActionsContext 未被提供');
  return ctx;
}
