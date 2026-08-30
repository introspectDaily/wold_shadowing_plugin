/**
 * 从有道词典页面 DOM 中提取已有的词条数据（音标 + 简明释义），
 * 这样页面内面板就不需要再发起自己的词典查询。
 * 使用最小化的 DOM 抽象，方便在 Node 里单测。
 */

export interface YoudaoDefinition {
  pos?: string;
  text: string;
}

export interface YoudaoPageInfo {
  phoneticUs?: string;
  phoneticUk?: string;
  definitions: YoudaoDefinition[];
}

export interface TextEl {
  textContent: string | null;
  querySelector(selector: string): TextEl | null;
  querySelectorAll(selector: string): Iterable<TextEl>;
}

export interface RootLike extends TextEl {
  querySelector(selector: string): TextEl | null;
}

/** 解析形如 “美 /əˈbændən/”、“英 /əˈbændən/”、“/əˈbændən/” 的音标文本 */
export function parsePhoneticText(
  text: string,
): { accent?: 'us' | 'uk'; phonetic?: string } {
  const t = text.trim();
  if (!t) return {};
  const prefixed = t.match(/^([英美])\s*(?:[:：])?\s*\/\s*(.*?)\s*\//);
  if (prefixed && prefixed[2]) {
    return {
      accent: prefixed[1] === '美' ? 'us' : 'uk',
      phonetic: prefixed[2],
    };
  }
  const bracketed = t.match(/^\/\s*(.*?)\s*\/$/);
  if (bracketed && bracketed[1]) return { phonetic: bracketed[1] };
  if (t.length <= 40 && /^[A-Za-z0-9:.ˌˈ'’\- ]+$/.test(t)) return { phonetic: t };
  return {};
}

/** 解析释义条目文本，如 “vt. 放弃；遗弃” → { pos: 'vt.', text: '放弃；遗弃' } */
export function parseDefinitionText(text: string): YoudaoDefinition {
  const t = text.trim().replace(/\s+/g, ' ').replace(/\u00a0/g, ' ');
  if (!t) return { text: '' };
  const m = t.match(/^([a-zA-Z]{1,4}\.)\s+(.+)$/);
  if (m && m[1] && m[2]) return { pos: m[1], text: m[2] };
  return { text: t };
}

const PHONETIC_SELECTORS = [
  '.phonetic',
  '.pronounce .phonetic',
  '.baav .phonetic',
];

export function extractPhonetics(root: RootLike): {
  us?: string;
  uk?: string;
} {
  const us: string[] = [];
  const uk: string[] = [];
  const plain: string[] = [];

  const add = (phonetic: string | undefined, accent?: 'us' | 'uk') => {
    if (!phonetic) return;
    if (accent === 'us') us.push(phonetic);
    else if (accent === 'uk') uk.push(phonetic);
    else if (!plain.includes(phonetic)) plain.push(phonetic);
  };

  // 当前有道（youdao.com / dict.youdao.com）结构：
  // .per-phone 内是「英/美 标签 + .phonetic 音标」
  for (const phone of root.querySelectorAll('.per-phone')) {
    const label = phone.querySelector('span')?.textContent?.trim();
    const phonetic = parsePhoneticText(
      phone.querySelector('.phonetic')?.textContent ?? '',
    ).phonetic;
    add(phonetic, label === '英' ? 'uk' : label === '美' ? 'us' : undefined);
  }

  // 兜底：文本自带「英/美」前缀的旧结构，或裸音标（页面顺序通常 英 在前、美 在后）
  for (const sel of PHONETIC_SELECTORS) {
    for (const el of root.querySelectorAll(sel)) {
      const p = parsePhoneticText(el.textContent ?? '');
      add(p.phonetic, p.accent);
    }
  }

  // 未被标签识别出的裸音标，按 英、美 顺序补位
  const used = new Set([...us, ...uk]);
  const remaining = plain.filter((p) => !used.has(p));
  return {
    us: us[0] ?? remaining[0],
    uk: uk[0] ?? remaining[1] ?? remaining[0],
  };
}

export function extractDefinitions(root: RootLike): YoudaoDefinition[] {
  const out: YoudaoDefinition[] = [];
  const seen = new Set<string>();
  const push = (pos: string | undefined, text: string | undefined) => {
    if (!text || seen.has(text)) return;
    seen.add(text);
    out.push({ pos, text });
  };

  // 当前有道：.simple（简明释义）模块，li.word-exp 内是 .pos + .trans
  for (const li of root.querySelectorAll('.simple .trans-container li')) {
    const pos = li.querySelector('.pos')?.textContent?.trim();
    const trans = li.querySelector('.trans')?.textContent?.trim();
    push(pos, trans);
  }
  if (out.length > 0) return out;

  // 旧版兜底：纯文本 li（词性前缀解析）
  for (const li of root.querySelectorAll(
    '#phrsListTab .trans-container li, .trans-container ul li',
  )) {
    const d = parseDefinitionText(li.textContent ?? '');
    push(d.pos, d.text);
  }
  return out;
}

export function extractYoudaoInfo(root: RootLike): YoudaoPageInfo {
  const { us, uk } = extractPhonetics(root);
  return {
    phoneticUs: us,
    phoneticUk: uk,
    definitions: extractDefinitions(root),
  };
}
