/**
 * 富文本清洗。
 *
 * 节点内容是用户粘贴进来的 HTML，而这个页面是**扩展页面**，
 * 能直接调用 chrome.* API —— 一旦混进 `<script>` 或 `onerror=`
 * 就不是普通的 XSS。所以落库前必须过一遍白名单。
 */

const DROP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'IFRAME',
  'OBJECT',
  'EMBED',
  'LINK',
  'META',
  'IMG',
  'VIDEO',
  'AUDIO',
  'FORM',
  'INPUT',
  'TEXTAREA',
  'BUTTON',
  'SVG',
  'MATH',
  'TEMPLATE',
  'BASE',
]);

const ALLOWED_TAGS = new Set([
  'B',
  'STRONG',
  'I',
  'EM',
  'U',
  'S',
  'STRIKE',
  'DEL',
  'CODE',
  'PRE',
  'BR',
  'DIV',
  'P',
  'SPAN',
  'UL',
  'OL',
  'LI',
  'A',
  'MARK',
  'BLOCKQUOTE',
]);

const ALLOWED_STYLE_PROPS = new Set([
  'color',
  'background-color',
  'font-weight',
  'font-style',
  'text-decoration',
  'text-decoration-line',
]);

function filterStyle(style: CSSStyleDeclaration): string {
  const parts: string[] = [];
  for (const prop of ALLOWED_STYLE_PROPS) {
    const value = style.getPropertyValue(prop);
    if (!value) continue;
    // 只允许普通颜色/字重等字面量，挡掉 url(...) / expression(...)
    if (/url\(|expression|javascript:/i.test(value)) continue;
    parts.push(`${prop}: ${value}`);
  }
  return parts.join('; ');
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 把纯文本转成安全的 HTML（老数据迁移、纯文本粘贴用） */
export function textToHtml(text: string): string {
  return text.split('\n').map(escapeHtml).join('<br>');
}

export function sanitizeHtml(html: string): string {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;

  const elements = Array.from(tpl.content.querySelectorAll('*'));
  for (const node of elements) {
    if (!node.isConnected) continue;
    const el = node as HTMLElement;
    const tag = el.tagName;

    if (DROP_TAGS.has(tag)) {
      el.remove();
      continue;
    }

    if (!ALLOWED_TAGS.has(tag)) {
      // 未知标签不删内容，只拆掉标签本身
      el.replaceWith(...Array.from(el.childNodes));
      continue;
    }

    for (const attr of Array.from(el.attributes)) {
      if (tag === 'A' && attr.name === 'href') {
        if (!/^(https?:|mailto:)/i.test(attr.value.trim())) el.removeAttribute('href');
        continue;
      }
      if (attr.name === 'style') {
        const kept = filterStyle(el.style);
        if (kept) el.setAttribute('style', kept);
        else el.removeAttribute('style');
        continue;
      }
      el.removeAttribute(attr.name);
    }

    if (tag === 'A') {
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noreferrer noopener');
    }
  }

  return tpl.innerHTML;
}

/** 取纯文本，用于占位判断和以后再接全文搜索 */
export function htmlToText(html: string): string {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  return (tpl.content.textContent ?? '').replace(/\u00a0/g, ' ');
}
