/**
 * Renders a small Markdown subset as DOM nodes.
 *
 * Model output is untrusted. This module never uses `innerHTML`. It builds
 * elements and text nodes, so raw HTML in the source stays visible text and
 * cannot execute.
 */

const FENCE = /^```/;
const HEADING = /^(#{1,3})\s+(.*)$/;
const BULLET = /^[-*]\s+(.*)$/;
const NUMBER = /^\d+\.\s+(.*)$/;
const SAFE_HREF = /^(https?:\/\/|mailto:)/i;
const INLINE = /`([^`]+)`|\*\*([\s\S]+?)\*\*|\*([^*\n]+)\*|_([^_\n]+)_|\[([^\]]*)\]\(([^)\s]*)\)/;

export function renderMarkdown(text: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const lines = text.split('\n');
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (line.trim() === '') {
      index += 1;
      continue;
    }
    if (FENCE.test(line)) {
      index = appendFence(fragment, lines, index);
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading !== null) {
      const level = heading[1]?.length ?? 1;
      appendInline(fragment.appendChild(document.createElement(`h${level}`)), heading[2] ?? '');
      index += 1;
      continue;
    }
    if (BULLET.test(line) || NUMBER.test(line)) {
      index = appendList(fragment, lines, index);
      continue;
    }
    index = appendParagraph(fragment, lines, index);
  }
  return fragment;
}

/** Collects lines until the closing fence, or to the end when it is absent. */
function appendFence(parent: ParentNode, lines: string[], start: number): number {
  const body: string[] = [];
  let index = start + 1;
  while (index < lines.length && !FENCE.test(lines[index] ?? '')) {
    body.push(lines[index] ?? '');
    index += 1;
  }
  const pre = document.createElement('pre');
  const code = document.createElement('code');
  code.textContent = body.length === 0 ? '' : `${body.join('\n')}\n`;
  pre.append(code);
  parent.append(pre);
  return index < lines.length ? index + 1 : index;
}

function appendList(parent: ParentNode, lines: string[], start: number): number {
  const ordered = NUMBER.test(lines[start] ?? '');
  const list = document.createElement(ordered ? 'ol' : 'ul');
  let index = start;
  while (index < lines.length) {
    const line = lines[index] ?? '';
    const item = (ordered ? NUMBER : BULLET).exec(line);
    if (item === null) break;
    appendInline(list.appendChild(document.createElement('li')), item[1] ?? '');
    index += 1;
  }
  parent.append(list);
  return index;
}

function appendParagraph(parent: ParentNode, lines: string[], start: number): number {
  const body: string[] = [];
  let index = start;
  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (line.trim() === '' || FENCE.test(line) || HEADING.test(line)) break;
    if (BULLET.test(line) || NUMBER.test(line)) break;
    body.push(line);
    index += 1;
  }
  appendInline(parent.appendChild(document.createElement('p')), body.join('\n'));
  return index;
}

function appendInline(parent: ParentNode, text: string): void {
  let rest = text;
  while (rest !== '') {
    const match = INLINE.exec(rest);
    if (match === null || match.index === undefined) break;
    if (match.index > 0) parent.append(rest.slice(0, match.index));
    parent.append(inlineNode(match));
    rest = rest.slice(match.index + match[0].length);
  }
  if (rest !== '') parent.append(rest);
}

function inlineNode(match: RegExpExecArray): Node {
  const [, code, strong, star, underscore, linkText, href] = match;
  if (code !== undefined) return element('code', code);
  if (strong !== undefined) return nested('strong', strong);
  if (star !== undefined) return nested('em', star);
  if (underscore !== undefined) return nested('em', underscore);
  return link(linkText ?? '', href ?? '');
}

function element(tag: string, text: string): HTMLElement {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

function nested(tag: string, text: string): HTMLElement {
  const node = document.createElement(tag);
  appendInline(node, text);
  return node;
}

/** Renders the label as plain text when the scheme is not http, https, or mailto. */
function link(text: string, href: string): Node {
  const target = href.trim();
  if (!SAFE_HREF.test(target)) return document.createTextNode(text);
  const node = document.createElement('a');
  node.href = target;
  node.rel = 'noopener noreferrer';
  node.target = '_blank';
  appendInline(node, text);
  return node;
}
