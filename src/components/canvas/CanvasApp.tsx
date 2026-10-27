import { FlowCanvas } from './FlowCanvas';
import { SectionTabs } from './SectionTabs';
import { Sidebar } from './Sidebar';
import { useCanvasLibrary } from '../../hooks/useCanvasLibrary';

/**
 * 无限画布笔记本（OneNote 形态）：
 *   左栏 = 笔记本切换 + 页面列表
 *   上方 = 分区标签
 *   右侧 = 无限画布
 */
export function CanvasApp() {
  const lib = useCanvasLibrary();

  if (!lib.ready) {
    return <div className="cv-loading">正在打开笔记本…</div>;
  }

  return (
    <div className="cv-app">
      <Sidebar
        notebooks={lib.notebooks}
        notebookId={lib.notebookId}
        pages={lib.pages}
        pageId={lib.pageId}
        onSelectNotebook={(id) => void lib.selectNotebook(id)}
        onCreateNotebook={() => void lib.createNotebook()}
        onRenameNotebook={(id, title) => void lib.renameNotebook(id, title)}
        onRemoveNotebook={(id) => void lib.removeNotebook(id)}
        onSelectPage={lib.selectPage}
        onCreatePage={() => void lib.createPage()}
        onRenamePage={lib.renamePage}
        onRemovePage={(id) => void lib.removePage(id)}
      />

      <main className="cv-main">
        <SectionTabs
          sections={lib.sections}
          sectionId={lib.sectionId}
          onSelect={(id) => void lib.selectSection(id)}
          onCreate={() => void lib.createSection()}
          onRename={(id, title) => void lib.renameSection(id, title)}
          onRemove={(id) => void lib.removeSection(id)}
        />

        {lib.activePage ? (
          <FlowCanvas
            key={lib.activePage.id}
            page={lib.activePage}
            onRenamePage={(title) => lib.renamePage(lib.activePage!.id, title)}
          />
        ) : (
          <div className="cv-empty">这个分区还没有页面</div>
        )}
      </main>
    </div>
  );
}
