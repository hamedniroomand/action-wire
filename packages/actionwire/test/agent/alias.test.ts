import { expect, it } from 'vitest';

import { createAliasTable } from '~/agent/alias';

it('keeps every alias inside the provider length limit', () => {
  const table = createAliasTable();
  const alias = table.aliasFor({ id: 'a'.repeat(120), name: 'b'.repeat(120) });
  expect(alias.length).toBeLessThanOrEqual(64);
  expect(alias).toMatch(/^[a-zA-Z0-9_-]+$/);
});

it('gives two tools that sanitize alike separate aliases', () => {
  const table = createAliasTable();
  const first = table.aliasFor({ id: 'one', name: 'create report' });
  const second = table.aliasFor({ id: 'two', name: 'create/report' });
  expect(first).not.toBe(second);
  expect(table.toolIdFor(first)).toBe('one');
  expect(table.toolIdFor(second)).toBe('two');
});

it('gives a usable alias to a name with no safe characters', () => {
  const table = createAliasTable();
  const alias = table.aliasFor({ id: 'cjk', name: '报告' });
  expect(alias).toMatch(/^[a-zA-Z0-9_-]+$/);
  expect(table.toolIdFor(alias)).toBe('cjk');
});

it('never reassigns the alias of a tool that left the page', () => {
  const table = createAliasTable();
  const first = table.aliasFor({ id: 'old', name: 'openProject' });
  const second = table.aliasFor({ id: 'new', name: 'openProject' });
  expect(second).not.toBe(first);
  expect(table.toolIdFor(first)).toBe('old');
  expect(table.aliasOf('old')).toBe(first);
});

it('keeps distinct aliases for the encode collision pair a.b and t_YS5i', () => {
  const table = createAliasTable();
  const dotted = table.aliasFor({ id: 'dot', name: 'a.b' });
  const encoded = table.aliasFor({ id: 'enc', name: 't_YS5i' });
  expect(dotted).not.toBe(encoded);
  expect(table.toolIdFor(dotted)).toBe('dot');
  expect(table.toolIdFor(encoded)).toBe('enc');
});

it('bounds aliases for a 128-character native name', () => {
  const table = createAliasTable();
  const alias = table.aliasFor({ id: 'long', name: 'n'.repeat(128) });
  expect(alias.length).toBeLessThanOrEqual(64);
});
