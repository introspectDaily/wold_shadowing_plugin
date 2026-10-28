import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  useReactFlow,
  useViewport,
  type NodeChange,
  type Viewport,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { getPage, getPageNodes, putAsset, putPage, putPageNodes } from '../../lib/canvas/db';
import { findFreePosition, newImageNode, newTextNode, nextZIndex } from '../../lib/canvas/model';
import type { CanvasNode, CanvasNodeData, NoteKind, Page } from '../../lib/canvas/types';
import { textToHtml } from '../../lib/canvas/sanitize';
import { uid } from '../../lib/ids';
import { HelperLines, useHelperLines } from './HelperLines';
import { ImageNodeView } from './ImageNode';
import { NoteNodeView } from './NoteNode';
import { NodeActionsContext, type NodeActions } from './nodeActions';
import { Toolbar } from './Toolbar';

const nodeTypes = { note: NoteNodeView, image: ImageNodeView };

/** 只保留需要落盘的字段，selected/dragging/measured 这些是运行时的 */
function serialize(nodes: CanvasNode[]): CanvasNode[] {
  return nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: { ...n.position },
    width: n.width,
    height: n.height,
    zIndex: n.zIndex,
    data: { ...n.data },
  })) as CanvasNode[];
}

function normalize(raw: unknown): CanvasNode[] {
  if (!Array.isArray(raw)) return [];
  // 老数据只有 text，补出 html 字段（富文本是后加的）
  return (raw as CanvasNode[]).map((n) => {
    if (n.data?.kind === 'image') return n;
    const d = n.data as { html?: string; text?: string; kind: string };
    if (typeof d.html === 'string' && d.html) return n;
    return {
      ...n,
      data: { ...n.data, html: textToHtml(d.text ?? '') },
    } as CanvasNode;
  });
}

interface FlowCanvasProps {
  page: Page;
  onRenamePage: (title: string) => void;
}

/** 每页一个独立实例（key=page.id），切页即重置画布状态 */
export function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasSurface {...props} />
    </ReactFlowProvider>
  );
}

function CanvasSurface({ page, onRenamePage }: FlowCanvasProps) {
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const nodesRef = useRef<CanvasNode[]>([]);
  nodesRef.current = nodes;

  const historyRef = useRef<{
    past: CanvasNode[][];
    future: CanvasNode[][];
    baseline: string;
  }>({ past: [], future: [], baseline: '[]' });
  const [histTick, setHistTick] = useState(0);

  const { screenToFlowPosition, fitView, setViewport } = useReactFlow();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /* ------------------------------ 载入 ------------------------------ */
  useEffect(() => {
    let alive = true;
    void (async () => {
      const [rec, meta] = await Promise.all([getPageNodes(page.id), getPage(page.id)]);
      if (!alive) return;
      const loadedNodes = normalize(rec?.nodes);
      setNodes(loadedNodes);
      historyRef.current = {
        past: [],
        future: [],
        baseline: JSON.stringify(serialize(loadedNodes)),
      };
      setLoaded(true);
      // 恢复上次的视口；没有就自适应内容
      if (meta?.viewport) {
        void setViewport(meta.viewport);
      } else if (loadedNodes.length > 0) {
        window.setTimeout(() => void fitView({ padding: 0.35, duration: 200 }), 60);
      }
    })();
    return () => {
      alive = false;
    };
  }, [fitView, page.id, setViewport]);

  /* --------------------------- 自动落盘 --------------------------- */
  const saveTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void putPageNodes(page.id, serialize(nodesRef.current));
    }, 400);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [nodes, loaded, page.id]);

  // 切页/卸载前补一次，避免最后一次修改丢失
  useEffect(() => {
    if (!loaded) return;
    return () => {
      void putPageNodes(page.id, serialize(nodesRef.current));
    };
  }, [page.id, loaded]);

  /* --------------------------- 撤销 / 重做 --------------------------- */
  // 采用「静置快照」：连续操作停手 400ms 后记一步。
  // 这样拖拽、打字、缩放都只算一步，撤销粒度接近人直觉。
  const settleTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!loaded) return;
    if (settleTimer.current) window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      const snapshot = JSON.stringify(serialize(nodesRef.current));
      const h = historyRef.current;
      if (snapshot === h.baseline) return;
      h.past.push(JSON.parse(h.baseline) as CanvasNode[]);
      if (h.past.length > 80) h.past.shift();
      h.future = [];
      h.baseline = snapshot;
      setHistTick((v) => v + 1);
    }, 400);
    return () => {
      if (settleTimer.current) window.clearTimeout(settleTimer.current);
    };
  }, [nodes, loaded]);

  const applySnapshot = useCallback((snapshot: CanvasNode[]) => {
    historyRef.current.baseline = JSON.stringify(serialize(snapshot));
    setNodes(snapshot.map((n) => ({ ...n, selected: false })));
    setHistTick((v) => v + 1);
  }, []);

  const undo = useCallback(() => {
    const h = historyRef.current;
    const prev = h.past.pop();
    if (!prev) return;
    h.future.push(JSON.parse(h.baseline) as CanvasNode[]);
    applySnapshot(prev);
  }, [applySnapshot]);

  const redo = useCallback(() => {
    const h = historyRef.current;
    const next = h.future.pop();
    if (!next) return;
    h.past.push(JSON.parse(h.baseline) as CanvasNode[]);
    applySnapshot(next);
  }, [applySnapshot]);

  const canUndo = historyRef.current.past.length > 0;
  const canRedo = historyRef.current.future.length > 0;
  void histTick;

  /* ----------------------------- 节点操作 ----------------------------- */
  const onNodesChange = useCallback((changes: NodeChange<CanvasNode>[]) => {
    setNodes((ns) => applyNodeChanges(changes, ns));
  }, []);

  const { guides, onNodeDrag, onNodeDragStop } = useHelperLines(setNodes, nodesRef);

  const actions = useMemo<NodeActions>(
    () => ({
      updateData(id, patch) {
        setNodes((ns) =>
          ns.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, ...patch } as CanvasNodeData } : n,
          ),
        );
      },
      remove(id) {
        setNodes((ns) => ns.filter((n) => n.id !== id));
      },
      bringToFront(id) {
        setNodes((ns) => {
          const top = nextZIndex(ns) + 1;
          return ns.map((n) => (n.id === id ? { ...n, zIndex: top } : n));
        });
      },
      sendToBack(id) {
        setNodes((ns) => {
          const bottom = ns.reduce((min, n) => Math.min(min, n.zIndex ?? 0), 0) - 1;
          return ns.map((n) => (n.id === id ? { ...n, zIndex: bottom } : n));
        });
      },
      editingId,
      beginEdit(id) {
        setEditingId(id);
      },
      endEdit() {
        setEditingId(null);
      },
    }),
    [editingId],
  );

  const addTextNode = useCallback(
    (kind: NoteKind) => {
      const center = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
      const node = newTextNode(kind, { x: 0, y: 0 }, nextZIndex(nodesRef.current));
      const w = node.width ?? 280;
      const h = node.height ?? 160;
      // 自动避开已有节点，避免新建的卡片正好压在别人身上
      node.position = findFreePosition(
        { x: center.x - w / 2, y: center.y - h / 2 },
        { width: w, height: h },
        nodesRef.current,
      );
      node.selected = true;
      setNodes((ns) => [...ns.map((n) => ({ ...n, selected: false })), node]);
      setEditingId(node.id);
    },
    [screenToFlowPosition],
  );

  const addImageFiles = useCallback(
    async (files: File[]) => {
      const images = files.filter((f) => f.type.startsWith('image/'));
      for (const file of images) {
        const id = uid('asset-');
        await putAsset(file, id);
        let width = 360;
        let height = 260;
        try {
          const bmp = await createImageBitmap(file);
          const scale = Math.min(1, 420 / bmp.width);
          width = Math.round(bmp.width * scale);
          height = Math.round(bmp.height * scale);
          bmp.close();
        } catch {
          /* 尺寸拿不到就用默认值 */
        }
        const center = screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        });
        const node = newImageNode(
          id,
          findFreePosition(
            { x: center.x - width / 2, y: center.y - height / 2 },
            { width, height },
            nodesRef.current,
          ),
          { width, height },
          nextZIndex(nodesRef.current),
        );
        setNodes((ns) => [...ns, node]);
      }
    },
    [screenToFlowPosition],
  );

  const deleteSelected = useCallback(() => {
    setNodes((ns) => (ns.some((n) => n.selected) ? ns.filter((n) => !n.selected) : ns));
  }, []);

  /* ------------------------------ 快捷键 ------------------------------ */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.isComposing) return;

      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (meta && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const hasSelected = nodesRef.current.some((n) => n.selected);
        if (hasSelected) {
          e.preventDefault();
          deleteSelected();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deleteSelected, redo, undo]);

  /* ------------------------------ 视口记忆 ------------------------------ */
  const viewportTimer = useRef<number | null>(null);
  const onMoveEnd = useCallback(
    (_e: unknown, vp: Viewport) => {
      if (viewportTimer.current) window.clearTimeout(viewportTimer.current);
      viewportTimer.current = window.setTimeout(() => {
        void getPage(page.id).then((p) => {
          if (p) void putPage({ ...p, viewport: vp, updatedAt: Date.now() });
        });
      }, 600);
    },
    [page.id],
  );

  return (
    <NodeActionsContext.Provider value={actions}>
      <div
        className="cv-surface"
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) e.preventDefault();
        }}
        onDrop={(e) => {
          if (!e.dataTransfer.files.length) return;
          e.preventDefault();
          void addImageFiles(Array.from(e.dataTransfer.files));
        }}
        onDoubleClick={(e) => {
          // 只响应空白画布的双击，节点自己的双击由节点处理
          const target = e.target as HTMLElement;
          if (!target.classList.contains('react-flow__pane')) return;
          e.preventDefault();
          addTextNode('note');
        }}
      >
        <Toolbar
          page={page}
          onRenamePage={onRenamePage}
          onAddText={addTextNode}
          onPickImage={() => fileInputRef.current?.click()}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) void addImageFiles(files);
            e.target.value = '';
          }}
        />

        <div className="cv-flow">
          <ReactFlow<CanvasNode>
            nodes={nodes}
            edges={[]}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onNodeDrag={onNodeDrag}
            onNodeDragStop={onNodeDragStop}
            onMoveEnd={onMoveEnd}
            minZoom={0.2}
            maxZoom={4}
            panOnScroll
            panOnDrag
            selectionKeyCode="Shift"
            multiSelectionKeyCode={['Meta', 'Control']}
            deleteKeyCode={null}
            zoomOnDoubleClick={false}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1.4} color="#c7ccd8" />
            <HelperLines guides={guides} />
            <Controls showInteractive={false} />
            {nodes.length > 0 && (
              <MiniMap pannable zoomable nodeStrokeWidth={2} />
            )}
          </ReactFlow>

          {nodes.length === 0 && (
            <div className="cv-hint">
              <div className="cv-hint__title">空白画布</div>
              <div className="cv-hint__line">双击空白处新建笔记</div>
              <div className="cv-hint__line">右上角工具栏可以加标题 / 待办 / 图片</div>
              <div className="cv-hint__line">拖拽平移 · 滚轮平移 · Ctrl+滚轮缩放</div>
            </div>
          )}
        </div>
      </div>
    </NodeActionsContext.Provider>
  );
}

/** 顶栏：页面标题 + 工具按钮 + 缩放比例 */
export function ZoomBadge() {
  const { zoom } = useViewport();
  return <span className="cv-zoom">{Math.round(zoom * 100)}%</span>;
}
