import { describe, expect, it } from 'vitest';
import {
  extractDefinitions,
  extractPhonetics,
  extractYoudaoInfo,
  parseDefinitionText,
  parsePhoneticText,
  type RootLike,
  type TextEl,
} from '../youdao-extract';

function el(textContent: string): TextEl {
  return {
    textContent,
    querySelector: () => null,
    querySelectorAll: () => [],
  };
}

/** 模拟当前有道页面的 .per-phone：标签 span + .phonetic span */
function perPhone(label: string, phonetic: string): TextEl {
  return {
    textContent: `${label}${phonetic}`,
    querySelector: (sel: string) =>
      sel === 'span' ? el(label) : sel === '.phonetic' ? el(phonetic) : null,
    querySelectorAll: () => [],
  };
}

/** 模拟 .simple .trans-container li.word-exp：.pos + .trans */
function simpleLi(pos: string, trans: string): TextEl {
  return {
    textContent: pos + trans,
    querySelector: (sel: string) =>
      sel === '.pos' ? el(pos) : sel === '.trans' ? el(trans) : null,
    querySelectorAll: () => [],
  };
}

function rootOf(selectors: Record<string, TextEl[]>): RootLike {
  return {
    textContent: null,
    querySelector: () => null,
    querySelectorAll: (sel: string) => {
      const out: TextEl[] = [];
      for (const part of sel.split(',')) {
        out.push(...(selectors[part.trim()] ?? []));
      }
      return out;
    },
  };
}

describe('parsePhoneticText', () => {
  it('解析带“美”前缀的音标', () => {
    expect(parsePhoneticText('美 /əˈbændən/')).toEqual({
      accent: 'us',
      phonetic: 'əˈbændən',
    });
  });

  it('解析带“英”前缀的音标', () => {
    expect(parsePhoneticText('英 /əˈbændən/')).toEqual({
      accent: 'uk',
      phonetic: 'əˈbændən',
    });
  });

  it('解析带空格的纯音标', () => {
    expect(parsePhoneticText('/ həˈləʊ /')).toEqual({ phonetic: 'həˈləʊ' });
  });

  it('非音标文本返回空', () => {
    expect(parsePhoneticText('放弃；遗弃')).toEqual({});
    expect(parsePhoneticText('')).toEqual({});
  });
});

describe('parseDefinitionText', () => {
  it('解析带词性的释义', () => {
    expect(parseDefinitionText('vt. 放弃；遗弃')).toEqual({
      pos: 'vt.',
      text: '放弃；遗弃',
    });
  });

  it('无词性时原样返回', () => {
    expect(parseDefinitionText('放弃；遗弃')).toEqual({ text: '放弃；遗弃' });
  });
});

describe('extractPhonetics（当前有道 .per-phone 结构）', () => {
  const root = rootOf({
    '.per-phone': [perPhone('英', '/ həˈləʊ /'), perPhone('美', '/ həˈloʊ /')],
  });

  it('按 英/美 标签正确分配', () => {
    expect(extractPhonetics(root)).toEqual({
      us: 'həˈloʊ',
      uk: 'həˈləʊ',
    });
  });
});

describe('extractDefinitions（当前有道 .simple 结构）', () => {
  const root = rootOf({
    '.simple .trans-container li': [
      simpleLi('int.', '喂，你好'),
      simpleLi('n.', '招呼，问候'),
    ],
  });

  it('提取 .pos + .trans', () => {
    expect(extractDefinitions(root)).toEqual([
      { pos: 'int.', text: '喂，你好' },
      { pos: 'n.', text: '招呼，问候' },
    ]);
  });

  it('没有 .simple 模块时回退到纯文本 li', () => {
    const old = rootOf({
      '.trans-container ul li': [el('vt. 放弃；遗弃'), el('n. 放任')],
    });
    expect(extractDefinitions(old)).toEqual([
      { pos: 'vt.', text: '放弃；遗弃' },
      { pos: 'n.', text: '放任' },
    ]);
  });
});

describe('extractYoudaoInfo 集成', () => {
  it('提取当前有道页面的音标与释义（不包含语速/发音工具栏）', () => {
    const root = rootOf({
      '.per-phone': [perPhone('英', '/ həˈləʊ /'), perPhone('美', '/ həˈloʊ /')],
      '.simple .trans-container li': [
        simpleLi('int.', '喂，你好（用于问候或打招呼）'),
        simpleLi('n.', '招呼，问候'),
      ],
    });
    expect(extractYoudaoInfo(root)).toEqual({
      phoneticUs: 'həˈloʊ',
      phoneticUk: 'həˈləʊ',
      definitions: [
        { pos: 'int.', text: '喂，你好（用于问候或打招呼）' },
        { pos: 'n.', text: '招呼，问候' },
      ],
    });
  });

  it('页面无数据时返回空结构', () => {
    expect(extractYoudaoInfo(rootOf({}))).toEqual({
      phoneticUs: undefined,
      phoneticUk: undefined,
      definitions: [],
    });
  });
});
