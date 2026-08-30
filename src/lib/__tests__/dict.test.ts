import { describe, expect, it } from 'vitest';
import { normalizeYoudao } from '../dict';

describe('normalizeYoudao（有道 jsonapi ec 解析）', () => {
  it('解析英美音标与简明释义', () => {
    const info = normalizeYoudao(
      {
        ec: {
          word: [
            {
              ukphone: 'həˈləʊ',
              usphone: 'həˈloʊ',
              trs: [
                {
                  tr: [
                    {
                      l: {
                        i: [
                          'int. 喂，你好（用于问候或打招呼）；喂，你好（打电话时的招呼语）',
                        ],
                      },
                    },
                  ],
                },
                { tr: [{ l: { i: ['n. 招呼，问候'] } }] },
              ],
            },
          ],
        },
      },
      'hello',
    );
    expect(info).toEqual({
      word: 'hello',
      phonetic: 'həˈləʊ',
      phoneticUs: 'həˈloʊ',
      phoneticUk: 'həˈləʊ',
      phonetics: [{ text: 'həˈləʊ' }, { text: 'həˈloʊ' }],
      meanings: [
        {
          partOfSpeech: 'int.',
          definitions: [
            { definition: '喂，你好（用于问候或打招呼）' },
            { definition: '喂，你好（打电话时的招呼语）' },
          ],
        },
        {
          partOfSpeech: 'n.',
          definitions: [{ definition: '招呼，问候' }],
        },
      ],
      fetchedAt: expect.any(Number),
    });
  });

  it('没有 ec 数据时返回 null', () => {
    expect(normalizeYoudao({}, 'hello')).toBeNull();
    expect(normalizeYoudao({ ec: {} }, 'hello')).toBeNull();
  });
});
