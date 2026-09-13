/* oxlint-disable typescript/no-unsafe-type-assertion -- These cases pass invalid runtime data through the typed API. */
import { expect, it } from 'vitest';

import { createToolRegistry, AgentError } from '~/core';
/* oxlint-disable eslint/no-await-in-loop -- Each replace mutates the shared registry, so the cases must run in order. */
import type { ToolDefinition } from '~/core';

const tool = (): ToolDefinition => ({
  id: 'echo',
  name: 'echo',
  description: 'Return input text.',
  readOnly: true,
  inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
});

it('keeps snapshots independent from caller changes and freezes nested values', async () => {
  const registry = createToolRegistry();
  const input = tool();
  const snapshot = await registry.replace([input]);
  input.name = 'changed';
  input.inputSchema['properties'] = {};
  expect(snapshot.tools[0]?.name).toBe('echo');
  expect(snapshot.tools[0]?.inputSchema['properties']).toEqual({ text: { type: 'string' } });
  expect(() => {
    snapshot.tools.at(0)!.inputSchema['properties'] = {};
  }).toThrow(TypeError);
  expect(Object.isFrozen(snapshot)).toBe(true);
  expect(Object.isFrozen(snapshot.tools)).toBe(true);
  expect(Object.isFrozen(snapshot.tools[0]?.inputSchema['properties'])).toBe(true);
});

it('keeps revisions stable for equal content regardless of object key order', async () => {
  const registry = createToolRegistry();
  expect(registry.getSnapshot()).toEqual({ revision: 0, tools: [] });
  const first = await registry.replace([tool()]);
  const next = tool();
  next.inputSchema = {
    required: ['text'],
    properties: { text: { type: 'string' } },
    type: 'object',
  };
  expect(await registry.replace([next])).toBe(first);
  expect((await registry.replace([{ ...next, consequential: true }])).revision).toBe(2);
  expect((await registry.replace([])).revision).toBe(3);
});

it.each([
  ['duplicate ID', () => [tool(), { ...tool(), name: 'second' }]],
  ['duplicate name', () => [tool(), { ...tool(), id: 'second' }]],
  ['empty name', () => [{ ...tool(), name: ' ' }]],
  ['empty ID', () => [{ ...tool(), id: '' }]],
  ['empty description', () => [{ ...tool(), description: '' }]],
  ['bad schema type', () => [{ ...tool(), inputSchema: { type: 'wrong' } }]],
  [
    'bad nested schema',
    () => [{ ...tool(), inputSchema: { type: 'object', properties: { text: { type: 4 } } } }],
  ],
  ['non-object root', () => [{ ...tool(), inputSchema: { type: 'string' } }]],
  [
    'unknown schema dialect',
    () => [
      { ...tool(), inputSchema: { type: 'object', $schema: 'https://invalid.example/schema' } },
    ],
  ],
])('rejects %s without replacing the last valid snapshot', async (_name, input) => {
  const registry = createToolRegistry();
  const previous = await registry.replace([tool()]);
  await expect(registry.replace(input())).rejects.toThrow(AgentError);
  await expect(registry.replace(input())).rejects.toThrow(
    expect.objectContaining({ code: 'INVALID_SCHEMA' }),
  );
  expect(registry.getSnapshot()).toBe(previous);
});

it('rejects values that JSON would lose or convert', async () => {
  const registry = createToolRegistry();
  for (const value of [undefined, NaN, Infinity, () => {}, new Date(), new Map(), 1n]) {
    const input = { ...tool(), inputSchema: { type: 'object', default: value } } as ToolDefinition;
    await expect(registry.replace([input])).rejects.toThrow(AgentError);
  }
  const cycle: Record<string, unknown> = { type: 'object' };
  cycle['self'] = cycle;
  await expect(
    registry.replace([{ ...tool(), inputSchema: cycle } as ToolDefinition]),
  ).rejects.toThrow(AgentError);
});

it('accepts nested boolean schemas and supported dialects without changing the input', async () => {
  const registry = createToolRegistry();
  for (const dialect of [
    'https://json-schema.org/draft/2020-12/schema',
    'http://json-schema.org/draft-07/schema#',
  ]) {
    const input = {
      ...tool(),
      inputSchema: {
        type: 'object',
        $schema: dialect,
        additionalProperties: false,
        properties: { blocked: false },
      },
    };
    expect((await registry.replace([input])).tools[0]?.inputSchema).toEqual(input.inputSchema);
  }
});
