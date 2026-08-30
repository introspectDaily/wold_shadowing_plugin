import { describe, expect, it } from 'vitest';
import { extractWordFromUrl, isEnglishWord } from '../word-from-url';

describe('extractWordFromUrl', () => {
  it('从 ?word= 参数识别单词', () => {
    expect(extractWordFromUrl('https://dict.youdao.com/result?word=abandon&lang=en')).toBe(
      'abandon',
    );
  });

  it('从 ?q= 参数识别单词', () => {
    expect(extractWordFromUrl('https://dict.youdao.com/search?q=hello')).toBe('hello');
  });

  it('从 /w/ 路径识别单词', () => {
    expect(extractWordFromUrl('https://dict.youdao.com/w/beautiful')).toBe('beautiful');
  });

  it('统一转为小写', () => {
    expect(extractWordFromUrl('https://dict.youdao.com/result?word=Abandon&lang=en')).toBe(
      'abandon',
    );
  });

  it('短语只取第一个词', () => {
    expect(extractWordFromUrl('https://dict.youdao.com/result?word=look%20up')).toBe('look');
  });

  it('中文查询返回 null', () => {
    expect(extractWordFromUrl('https://dict.youdao.com/search?q=%E4%BD%A0%E5%A5%BD')).toBe(
      null,
    );
  });

  it('URL 解码 /w/ 路径', () => {
    expect(extractWordFromUrl('https://dict.youdao.com/w/%E5%8D%95%E8%AF%8D')).toBe(null);
  });

  it('无单词信息的 URL 返回 null', () => {
    expect(extractWordFromUrl('https://dict.youdao.com/')).toBe(null);
  });
});

describe('isEnglishWord', () => {
  it('允许大小写字母与撇号', () => {
    expect(isEnglishWord("don't")).toBe(true);
    expect(isEnglishWord('word')).toBe(true);
  });

  it('拒绝中文与数字开头', () => {
    expect(isEnglishWord('你好')).toBe(false);
    expect(isEnglishWord('123abc')).toBe(false);
    expect(isEnglishWord(undefined)).toBe(false);
  });
});
