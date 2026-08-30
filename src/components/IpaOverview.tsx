import { useEffect, useRef, useState } from 'react';
import { getPhoneme } from '../lib/ipa-data';
import {
  useOverviewConfig,
  effectiveWords,
  SUBTITLE_DURATION_PRESETS,
  SUBTITLE_DURATION_MAX,
  clampSubtitleDuration,
  type Accent,
  type PlayMode,
} from '../lib/ipaOverviewConfig';
import { useOverviewPlay } from '../lib/useOverviewPlay';
import { Icon } from './Icon';

interface OverviewCell {
  symbol: string;
  label: string;
}

interface OverviewRow {
  left: string;
  leftRowspan?: number;
  mid: string;
  midColspan?: number;
  cells: OverviewCell[];
}

interface OverviewSection {
  title: string;
  rows: OverviewRow[];
}

const TABLE = {
  heading: '国际音标表',
  sections: [
    {
      title: '元音',
      rows: [
        {
          left: '单元音',
          leftRowspan: 2,
          mid: '长元音',
          cells: [
            { symbol: '/iː/', label: '/iː/' },
            { symbol: '/uː/', label: '/uː/' },
            { symbol: '/ɔː/', label: '/ɔː/' },
            { symbol: '/ɑː/', label: '/ɑː/' },
            { symbol: '/ɜː/', label: '/ɜː/' },
          ],
        },
        {
          left: '单元音',
          leftRowspan: 2,
          mid: '短元音',
          cells: [
            { symbol: '/ɪ/', label: '/ɪ/' },
            { symbol: '/ʊ/', label: '/ʊ/' },
            { symbol: '/ɒ/', label: '/ɒ/' },
            { symbol: '/æ/', label: '/æ/' },
            { symbol: '/ə/', label: '/ə/' },
            { symbol: '/ʌ/', label: '/ʌ/' },
            { symbol: '/e/', label: '/e/' },
          ],
        },
        {
          left: '双元音',
          mid: '',
          midColspan: 2,
          cells: [
            { symbol: '/eɪ/', label: '/eɪ/' },
            { symbol: '/aɪ/', label: '/aɪ/' },
            { symbol: '/ɔɪ/', label: '/ɔɪ/' },
            { symbol: '/aʊ/', label: '/aʊ/' },
            { symbol: '/əʊ/', label: '/əʊ/' },
            { symbol: '/ɪə/', label: '/ɪə/' },
            { symbol: '/eə/', label: '/eə/' },
          ],
        },
      ],
    },
    {
      title: '辅音',
      rows: [
        {
          left: '清浊成对',
          leftRowspan: 2,
          mid: '清音',
          cells: [
            { symbol: '/p/', label: '/p/' },
            { symbol: '/t/', label: '/t/' },
            { symbol: '/k/', label: '/k/' },
            { symbol: '/f/', label: '/f/' },
            { symbol: '/s/', label: '/s/' },
            { symbol: '/ʃ/', label: '/ʃ/' },
            { symbol: '/tʃ/', label: '/tʃ/' },
            { symbol: '/tr/', label: '/tr/' },
            { symbol: '/ts/', label: '/ts/' },
          ],
        },
        {
          left: '清浊成对',
          leftRowspan: 2,
          mid: '浊音',
          cells: [
            { symbol: '/b/', label: '/b/' },
            { symbol: '/d/', label: '/d/' },
            { symbol: '/ɡ/', label: '/g/' },
            { symbol: '/v/', label: '/v/' },
            { symbol: '/z/', label: '/z/' },
            { symbol: '/ʒ/', label: '/ʒ/' },
            { symbol: '/dʒ/', label: '/dʒ/' },
            { symbol: '/dr/', label: '/dr/' },
            { symbol: '/dz/', label: '/dz/' },
          ],
        },
        {
          left: '其他',
          mid: '',
          midColspan: 2,
          cells: [
            { symbol: '/m/', label: '/m/' },
            { symbol: '/n/', label: '/n/' },
            { symbol: '/ŋ/', label: '/ŋ/' },
            { symbol: '/l/', label: '/l/' },
            { symbol: '/r/', label: '/r/' },
            { symbol: '/h/', label: '/h/' },
            { symbol: '/w/', label: '/w/' },
            { symbol: '/j/', label: '/j/' },
          ],
        },
      ],
    },
  ],
} as {
  heading: string;
  sections: OverviewSection[];
};

interface PopState {
  symbol: string;
  x: number;
  y: number;
}

function WordConfigPopover({
  symbol,
  x,
  y,
  onClose,
  onShadow,
}: {
  symbol: string;
  x: number;
  y: number;
  onClose: () => void;
  onShadow: (symbol: string) => void;
}) {
  const { config, setWordList } = useOverviewConfig();
  const p = getPhoneme(symbol);
  const ref = useRef<HTMLDivElement>(null);
  const all = p?.words.map((w) => w.word) ?? [];
  const selected = effectiveWords(symbol, config);
  const selectedSet = new Set(selected);

  // 让浮层出现在鼠标右键位置附近，避免超出视口
  const POP_W = 230;
  const POP_H = 300;
  const pos = {
    left: Math.min(x + 8, window.innerWidth - POP_W - 8),
    top: Math.min(y + 8, window.innerHeight - POP_H - 8),
  };

  // 仅在点击浮层外部（mousedown）时关闭；
  // 不能监听 contextmenu，否则右键打开时会因事件冒泡到 document 而被立刻关闭。
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [onClose]);

  const toggle = (word: string) => {
    const next = selectedSet.has(word)
      ? selected.filter((w) => w !== word)
      : [...selected, word];
    void setWordList(symbol, next);
  };

  return (
    <div className="overview-wordpop" ref={ref} style={pos}>
      <div className="overview-wordpop-head">
        <span className="overview-wordpop-title">
          左键点击「{symbol}」时播放的单词
        </span>
      </div>
      <button
        type="button"
        className="overview-wordpop-shadow"
        onClick={() => onShadow(symbol)}
        title="进入该音标的跟读练习页"
      >
        <Icon name="mic" size={13} />
        进入跟读
      </button>
      {all.length === 0 ? (
        <div className="muted small">该音标暂无示例单词</div>
      ) : (
        all.map((w) => (
          <label key={w} className="overview-wordpop-opt">
            <input
              type="checkbox"
              checked={selectedSet.has(w)}
              onChange={() => toggle(w)}
            />
            <span>{w}</span>
          </label>
        ))
      )}
      <button
        type="button"
        className="overview-wordpop-reset"
        onClick={() => void setWordList(symbol, all)}
      >
        恢复默认（全部）
      </button>
    </div>
  );
}

function RowView({
  row,
  rowIndex,
  onPlay,
  onEdit,
  playing,
}: {
  row: OverviewRow;
  rowIndex: number;
  onPlay: (s: string) => void;
  onEdit: (s: string, x: number, y: number) => void;
  playing: (s: string) => boolean;
}) {
  return (
    <tr>
      {(rowIndex === 0 || !row.leftRowspan) && (
        <th rowSpan={row.leftRowspan ?? 1} className="overview-left">
          {row.left}
        </th>
      )}
      {row.mid !== '' && <td className="overview-mid">{row.mid}</td>}
      <td colSpan={row.midColspan ?? 1} className="overview-cells">
        <div className="overview-cell-list">
          {row.cells.map((c) => {
            const p = getPhoneme(c.symbol);
            return (
              <button
                key={c.symbol}
                type="button"
                className={`overview-cell ${p ? '' : 'missing'} ${playing(c.symbol) ? 'playing' : ''}`}
                onClick={() => onPlay(c.symbol)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onEdit(c.symbol, e.clientX, e.clientY);
                }}
                title={p ? '左键播放 · 右键设置播放单词' : '暂无数据'}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </td>
    </tr>
  );
}

export function IpaOverview({
  onShadow,
}: {
  /** 进入某音标的跟读练习页 */
  onShadow: (symbol: string) => void;
}) {
  const {
    config,
    setAccent,
    setMode,
    setSubtitleEnabled,
    setSubtitleDuration,
  } = useOverviewConfig();
  const play = useOverviewPlay();
  const [pop, setPop] = useState<PopState | null>(null);
  const [subtitleVisible, setSubtitleVisible] = useState(false);
  const subtitleTimer = useRef<number | null>(null);

  const handleClick = (symbol: string) => {
    const words = effectiveWords(symbol, config);
    play.play(symbol, words, config.mode, config.accent);
  };

  const handleEdit = (symbol: string, x: number, y: number) => {
    setPop({ symbol, x, y });
  };

  // 字幕自动消失：每次播放词变化时重置计时器
  useEffect(() => {
    if (!config.subtitleEnabled) {
      setSubtitleVisible(false);
      return;
    }
    if (!play.current) {
      setSubtitleVisible(false);
      return;
    }
    setSubtitleVisible(true);
    if (config.subtitleDuration > 0) {
      if (subtitleTimer.current) window.clearTimeout(subtitleTimer.current);
      subtitleTimer.current = window.setTimeout(() => {
        setSubtitleVisible(false);
      }, config.subtitleDuration * 1000);
    }
    return () => {
      if (subtitleTimer.current) window.clearTimeout(subtitleTimer.current);
    };
  }, [play.current, config.subtitleEnabled, config.subtitleDuration]);

  const durationLabel = (d: number) => (d === 0 ? '无限' : `${d}s`);

  return (
    <div className="ipa-overview">
      <div className="overview-toolbar">
        <div className="overview-control">
          <span className="overview-label">口音</span>
          <div className="chip-group">
            {(['us', 'uk'] as Accent[]).map((ac) => (
              <button
                key={ac}
                type="button"
                className={`chip ${config.accent === ac ? 'active' : ''}`}
                onClick={() => void setAccent(ac)}
              >
                {ac === 'us' ? '美音' : '英音'}
              </button>
            ))}
          </div>
        </div>
        <div className="overview-control">
          <span className="overview-label">点击方式</span>
          <div className="chip-group">
            {(['all', 'one'] as PlayMode[]).map((m) => (
              <button
                key={m}
                type="button"
                className={`chip ${config.mode === m ? 'active' : ''}`}
                onClick={() => void setMode(m)}
              >
                {m === 'all' ? '一次播整个清单' : '逐个循环'}
              </button>
            ))}
          </div>
        </div>
        <div className="overview-control">
          <span className="overview-label">字幕</span>
          <label className="switch">
            <input
              type="checkbox"
              checked={config.subtitleEnabled}
              onChange={(e) => void setSubtitleEnabled(e.target.checked)}
            />
            <span className="slider" />
          </label>
        </div>
        {config.subtitleEnabled && (
          <div className="overview-control">
            <span className="overview-label">字幕时长</span>
            <div className="chip-group">
              {SUBTITLE_DURATION_PRESETS.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`chip ${config.subtitleDuration === d ? 'active' : ''}`}
                  onClick={() => void setSubtitleDuration(d)}
                >
                  {durationLabel(d)}
                </button>
              ))}
            </div>
            <input
              type="number"
              className="overview-duration-input"
              min={1}
              max={SUBTITLE_DURATION_MAX}
              value={config.subtitleDuration > 0 ? config.subtitleDuration : ''}
              placeholder="自定义秒数"
              onBlur={(e) => {
                const n = parseFloat(e.target.value);
                if (!Number.isNaN(n)) void setSubtitleDuration(n);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const n = parseFloat((e.target as HTMLInputElement).value);
                  if (!Number.isNaN(n)) void setSubtitleDuration(n);
                }
              }}
            />
          </div>
        )}
      </div>

      <p className="ipa-intro">
        整个音标表一览无余，无需滚动。左键点击音标即可播放示例单词；右键音标可自定义左键点击时播放的单词清单，或进入跟读。
      </p>

      <div className="overview-table-wrap">
        <table className="overview-table">
          <thead>
            <tr>
              <th colSpan={3}>{TABLE.heading}</th>
            </tr>
          </thead>
          <tbody>
            {TABLE.sections.map((section, si) => (
              <FragmentRows
                key={section.title}
                section={section}
                si={si}
                onPlay={handleClick}
                onEdit={handleEdit}
                playing={play.isPlaying}
              />
            ))}
          </tbody>
        </table>
      </div>

      {pop && (
        <WordConfigPopover
          symbol={pop.symbol}
          x={pop.x}
          y={pop.y}
          onClose={() => setPop(null)}
          onShadow={(symbol) => {
            setPop(null);
            onShadow(symbol);
          }}
        />
      )}

      {config.subtitleEnabled && subtitleVisible && play.current && (
        <div className="overview-subtitle" key={play.current.word}>
          <span className="overview-subtitle-symbol">{play.current.symbol}</span>
          <span className="overview-subtitle-word">{play.current.word}</span>
        </div>
      )}
    </div>
  );
}

function FragmentRows({
  section,
  si,
  onPlay,
  onEdit,
  playing,
}: {
  section: OverviewSection;
  si: number;
  onPlay: (s: string) => void;
  onEdit: (s: string, x: number, y: number) => void;
  playing: (s: string) => boolean;
}) {
  return (
    <>
      <tr className="overview-section-row">
        <th colSpan={3}>{section.title}</th>
      </tr>
      {section.rows.map((row, ri) => (
        <RowView
          key={`${si}-${ri}`}
          row={row}
          rowIndex={ri}
          onPlay={onPlay}
          onEdit={onEdit}
          playing={playing}
        />
      ))}
    </>
  );
}
