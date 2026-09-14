import { expect, it } from 'vitest';

import type { Json } from '~/core';
import { validateToolArguments } from '~/core/arguments';

it('accepts an object that matches a simple schema', () => {
  expect(
    validateToolArguments(
      { type: 'object', properties: { name: { type: 'string' } } },
      { name: 'Atlas' },
    ),
  ).toBe(true);
});

it('rejects missing required properties and wrong types', () => {
  const schema: Record<string, Json> = {
    type: 'object',
    properties: { count: { type: 'integer' } },
    required: ['count'],
  };
  expect(validateToolArguments(schema, {})).toBe(false);
  expect(validateToolArguments(schema, { count: '1' })).toBe(false);
});

it('rejects unsupported schema dialects', () => {
  expect(
    validateToolArguments(
      { type: 'object', $schema: 'http://json-schema.org/draft-04/schema#' },
      {},
    ),
  ).toBe(false);
});

it('validates against a frozen schema from the tool registry', () => {
  const schema = Object.freeze({
    type: 'object',
    additionalProperties: false,
  }) as Record<string, Json>;
  expect(validateToolArguments(schema, {})).toBe(true);
});
