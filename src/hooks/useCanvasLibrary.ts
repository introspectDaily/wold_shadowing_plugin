/**
 * 笔记本 / 分区 / 页 三层结构的状态管理。
 *
 * OneNote 的层级：一个笔记本下有多个分区，一个分区下有多个页面。
 * 这里只做「谁被选中」+「增删改」+ 落盘，画布内容由 FlowCanvas 自己管。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  deleteNotebook as dbDeleteNotebook,
  deletePage as dbDeletePage,
  deleteSection as dbDeleteSection,
  getMeta,
  listNotebooks,
  listPages,
  listSections,
  putNotebook,
  putPage,
  putSection,
  setMeta,
} from '../lib/canvas/db';
import { newNotebook, newPage, newSection } from '../lib/canvas/model';
import type { Notebook, Page, Section } from '../lib/canvas/types';

interface LibraryState {
  notebooks: Notebook[];
  sections: Section[];
  pages: Page[];
  notebookId: string | null;
  sectionId: string | null;
  pageId: string | null;
  ready: boolean;
}

const LAST_PAGE_KEY = 'lastPage';

export function useCanvasLibrary() {
  const [state, setState] = useState<LibraryState>({
    notebooks: [],
    sections: [],
    pages: [],
    notebookId: null,
    sectionId: null,
    pageId: null,
    ready: false,
  });

  /* ---------------------------- 初始化：保证有东西可看 ---------------------------- */
  useEffect(() => {
    let alive = true;
    void (async () => {
      let notebooks = await listNotebooks();
      if (notebooks.length === 0) {
        const nb = newNotebook();
        await putNotebook(nb);
        const sec = newSection(nb.id, '笔记');
        await putSection(sec);
        const page = newPage(sec.id, '第一页');
        await putPage(page);
        notebooks = [nb];
      }

      const lastPageId = await getMeta<string>(LAST_PAGE_KEY);
      let target: { notebookId: string; sectionId: string; pageId: string } | null = null;

      for (const nb of notebooks) {
        const sections = await listSections(nb.id);
        for (const sec of sections) {
          const pages = await listPages(sec.id);
          const hit = pages.find((p) => p.id === lastPageId);
          if (hit) {
            target = { notebookId: nb.id, sectionId: sec.id, pageId: hit.id };
            break;
          }
        }
        if (target) break;
      }

      if (!target) {
        // 没有上次打开的记录：回退到第一个笔记本的第一个分区第一页，
        // 空的分区/笔记本就地补一个，避免打开就是空白界面。
        const nb = notebooks[0]!;
        let sections = await listSections(nb.id);
        if (sections.length === 0) {
          const sec = newSection(nb.id, '笔记');
          await putSection(sec);
          sections = [sec];
        }
        let pages = await listPages(sections[0]!.id);
        if (pages.length === 0) {
          const page = newPage(sections[0]!.id, '第一页');
          await putPage(page);
          pages = [page];
        }
        target = { notebookId: nb.id, sectionId: sections[0]!.id, pageId: pages[0]!.id };
      }

      const sections = await listSections(target.notebookId);
      const pages = await listPages(target.sectionId);
      if (!alive) return;
      setState({
        notebooks,
        sections,
        pages,
        notebookId: target.notebookId,
        sectionId: target.sectionId,
        pageId: target.pageId,
        ready: true,
      });
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* --------------------------------- 选中流转 --------------------------------- */
  const selectNotebook = useCallback(async (notebookId: string) => {
    const sections = await listSections(notebookId);
    let nextSections = sections;
    if (nextSections.length === 0) {
      const sec = newSection(notebookId, '笔记');
      await putSection(sec);
      nextSections = [sec];
    }
    let pages = await listPages(nextSections[0]!.id);
    if (pages.length === 0) {
      const page = newPage(nextSections[0]!.id, '第一页');
      await putPage(page);
      pages = [page];
    }
    setState((s) => ({
      ...s,
      notebookId,
      sections: nextSections,
      sectionId: nextSections[0]!.id,
      pages,
      pageId: pages[0]!.id,
    }));
  }, []);

  const selectSection = useCallback(async (sectionId: string) => {
    let pages = await listPages(sectionId);
    if (pages.length === 0) {
      const page = newPage(sectionId, '第一页');
      await putPage(page);
      pages = [page];
    }
    setState((s) => ({ ...s, sectionId, pages, pageId: pages[0]!.id }));
  }, []);

  const selectPage = useCallback((pageId: string) => {
    setState((s) => ({ ...s, pageId }));
  }, []);

  /* 记住上次打开的是哪一页 */
  const lastSaved = useRef<string | null>(null);
  useEffect(() => {
    if (!state.pageId || state.pageId === lastSaved.current) return;
    lastSaved.current = state.pageId;
    void setMeta(LAST_PAGE_KEY, state.pageId);
  }, [state.pageId]);

  /* --------------------------------- 笔记本增删改 -------------------------------- */
  const createNotebook = useCallback(async () => {
    const nb = newNotebook(`笔记本 ${state.notebooks.length + 1}`);
    await putNotebook(nb);
    setState((s) => ({ ...s, notebooks: [...s.notebooks, nb] }));
    await selectNotebook(nb.id);
    return nb;
  }, [selectNotebook, state.notebooks.length]);

  const renameNotebook = useCallback(async (id: string, title: string) => {
    const nb = (await listNotebooks()).find((x) => x.id === id);
    if (!nb) return;
    const next = { ...nb, title, updatedAt: Date.now() };
    await putNotebook(next);
    setState((s) => ({ ...s, notebooks: s.notebooks.map((x) => (x.id === id ? next : x)) }));
  }, []);

  const removeNotebook = useCallback(
    async (id: string) => {
      await dbDeleteNotebook(id);
      const notebooks = await listNotebooks();
      if (notebooks.length === 0) {
        const nb = newNotebook();
        await putNotebook(nb);
        setState((s) => ({ ...s, notebooks: [nb] }));
        await selectNotebook(nb.id);
        return;
      }
      setState((s) => ({ ...s, notebooks }));
      if (state.notebookId === id) await selectNotebook(notebooks[0]!.id);
    },
    [selectNotebook, state.notebookId],
  );

  /* --------------------------------- 分区增删改 -------------------------------- */
  const createSection = useCallback(async () => {
    if (!state.notebookId) return;
    const sec = newSection(state.notebookId, `分区 ${state.sections.length + 1}`);
    await putSection(sec);
    setState((s) => ({ ...s, sections: [...s.sections, sec] }));
    await selectSection(sec.id);
  }, [selectSection, state.notebookId, state.sections.length]);

  const renameSection = useCallback(async (id: string, title: string) => {
    setState((s) => {
      const target = s.sections.find((x) => x.id === id);
      if (!target) return s;
      const next = { ...target, title, updatedAt: Date.now() };
      void putSection(next);
      return { ...s, sections: s.sections.map((x) => (x.id === id ? next : x)) };
    });
  }, []);

  const removeSection = useCallback(
    async (id: string) => {
      await dbDeleteSection(id);
      if (!state.notebookId) return;
      const sections = await listSections(state.notebookId);
      if (sections.length === 0) {
        const sec = newSection(state.notebookId, '笔记');
        await putSection(sec);
        setState((s) => ({ ...s, sections: [sec] }));
        await selectSection(sec.id);
        return;
      }
      setState((s) => ({ ...s, sections }));
      if (state.sectionId === id) await selectSection(sections[0]!.id);
    },
    [selectSection, state.notebookId, state.sectionId],
  );

  /* --------------------------------- 页面增删改 -------------------------------- */
  const createPage = useCallback(async () => {
    if (!state.sectionId) return;
    const page = newPage(state.sectionId, `页面 ${state.pages.length + 1}`);
    await putPage(page);
    setState((s) => ({ ...s, pages: [...s.pages, page], pageId: page.id }));
  }, [state.pages.length, state.sectionId]);

  const renamePage = useCallback((id: string, title: string) => {
    setState((s) => {
      const target = s.pages.find((x) => x.id === id);
      if (!target) return s;
      const next = { ...target, title, updatedAt: Date.now() };
      void putPage(next);
      return { ...s, pages: s.pages.map((x) => (x.id === id ? next : x)) };
    });
  }, []);

  const removePage = useCallback(
    async (id: string) => {
      await dbDeletePage(id);
      if (!state.sectionId) return;
      const pages = await listPages(state.sectionId);
      if (pages.length === 0) {
        const page = newPage(state.sectionId, '第一页');
        await putPage(page);
        setState((s) => ({ ...s, pages: [page], pageId: page.id }));
        return;
      }
      setState((s) => ({
        ...s,
        pages,
        pageId: s.pageId === id ? pages[0]!.id : s.pageId,
      }));
    },
    [state.sectionId],
  );

  const activePage = state.pages.find((p) => p.id === state.pageId) ?? null;

  return {
    ...state,
    activePage,
    selectNotebook,
    selectSection,
    selectPage,
    createNotebook,
    renameNotebook,
    removeNotebook,
    createSection,
    renameSection,
    removeSection,
    createPage,
    renamePage,
    removePage,
  };
}
