/** 从有道词典页面 URL 中识别当前单词（纯函数，便于测试） */
export function isEnglishWord(w: string | undefined): w is string {
  return !!w && /^[a-zA-Z][a-zA-Z'’-]*$/.test(w);
}

export function extractWordFromUrl(href: string): string | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const fromParam =
    url.searchParams.get('word') || url.searchParams.get('q') || '';
  if (fromParam.trim()) {
    const w = fromParam.trim().split(/\s+/)[0];
    if (isEnglishWord(w)) return w.toLowerCase();
  }
  const pathMatch = url.pathname.match(/\/w\/([^/]+)/);
  const pathWord = pathMatch?.[1];
  if (pathWord) {
    try {
      const w = decodeURIComponent(pathWord).trim().split(/\s+/)[0];
      if (isEnglishWord(w)) return w.toLowerCase();
    } catch {
      /* ignore */
    }
  }
  return null;
}
