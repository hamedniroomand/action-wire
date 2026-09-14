// @vitest-environment happy-dom

import { expect, it } from 'vitest';

import { renderMarkdown } from '~/widget/markdown';

function render(text: string): HTMLElement {
  const host = document.createElement('div');
  host.append(renderMarkdown(text));
  return host;
}

it('renders bold, italic, and inline code', () => {
  const node = render('You last had **Nova** open, in *this* app, run `listProjects`.');
  expect(node.querySelector('strong')?.textContent).toBe('Nova');
  expect(node.querySelector('em')?.textContent).toBe('this');
  expect(node.querySelector('code')?.textContent).toBe('listProjects');
  expect(node.textContent).toContain('You last had Nova open');
});

it('renders underscore italic', () => {
  expect(render('a _b_ c').querySelector('em')?.textContent).toBe('b');
});

it('splits paragraphs on a blank line', () => {
  const node = render('First line.\n\nSecond line.');
  const paragraphs = node.querySelectorAll('p');
  expect(paragraphs).toHaveLength(2);
  expect(paragraphs[0]?.textContent).toBe('First line.');
  expect(paragraphs[1]?.textContent).toBe('Second line.');
});

it('renders headings up to level three', () => {
  const node = render('# One\n\n## Two\n\n### Three');
  expect(node.querySelector('h1')?.textContent).toBe('One');
  expect(node.querySelector('h2')?.textContent).toBe('Two');
  expect(node.querySelector('h3')?.textContent).toBe('Three');
});

it('renders unordered and ordered lists', () => {
  const bullets = render('- Phoenix\n- Orion\n- Atlas');
  expect(bullets.querySelectorAll('ul > li')).toHaveLength(3);
  expect(bullets.querySelector('ul > li')?.textContent).toBe('Phoenix');

  const numbers = render('1. First\n2. Second');
  expect(numbers.querySelectorAll('ol > li')).toHaveLength(2);
  expect(numbers.querySelectorAll('ol > li')[1]?.textContent).toBe('Second');
});

it('renders inline markup inside list items', () => {
  const node = render('- Open **Nova**');
  expect(node.querySelector('li > strong')?.textContent).toBe('Nova');
});

it('renders a fenced code block and keeps its content literal', () => {
  const node = render('Run this:\n\n```\nconst a = **not bold**;\n```');
  const code = node.querySelector('pre > code');
  expect(code?.textContent).toBe('const a = **not bold**;\n');
  expect(code?.querySelector('strong')).toBeNull();
});

it('renders an http link with a safe target', () => {
  const link = render('See [the docs](https://example.com/a).').querySelector('a');
  expect(link?.getAttribute('href')).toBe('https://example.com/a');
  expect(link?.textContent).toBe('the docs');
  expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
  expect(link?.getAttribute('target')).toBe('_blank');
});

it('refuses a javascript link and keeps the text', () => {
  const node = render('Click [here](javascript:alert(1)) now.');
  expect(node.querySelector('a')).toBeNull();
  expect(node.textContent).toContain('here');
});

it('refuses a data link and a link that hides the scheme behind spaces', () => {
  expect(render('[x](data:text/html;base64,PHNjcmlwdD4=)').querySelector('a')).toBeNull();
  expect(render('[x](  javascript:alert(1))').querySelector('a')).toBeNull();
});

it('keeps raw HTML inert', () => {
  const node = render('<img src="x" onerror="alert(1)"> and <script>alert(2)</script>');
  expect(node.querySelector('img')).toBeNull();
  expect(node.querySelector('script')).toBeNull();
  expect(node.textContent).toContain('<img src="x" onerror="alert(1)">');
});

it('keeps raw HTML inert inside a fenced block and inline code', () => {
  expect(render('```\n<img src=x onerror=alert(1)>\n```').querySelector('img')).toBeNull();
  expect(render('`<img src=x>`').querySelector('img')).toBeNull();
});

it('returns an empty fragment for empty input', () => {
  expect(render('').childNodes).toHaveLength(0);
  expect(render('   \n  ').childNodes).toHaveLength(0);
});
