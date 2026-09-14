export const OBJECT = { type: 'object', additionalProperties: false } as const;

export const ID = {
  type: 'object',
  additionalProperties: false,
  properties: { id: { type: 'string' } },
  required: ['id'],
} as const;

export const NAME = {
  type: 'object',
  additionalProperties: false,
  properties: { name: { type: 'string' } },
  required: ['name'],
} as const;

export const RENAME = {
  type: 'object',
  additionalProperties: false,
  properties: { id: { type: 'string' }, name: { type: 'string' } },
  required: ['id', 'name'],
} as const;

export const REPORT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    chartId: { type: 'string' },
    chartVersion: { type: 'string' },
    title: { type: 'string' },
    audience: { type: 'string' },
    week: { type: 'integer' },
  },
  required: ['chartId', 'chartVersion', 'title', 'audience', 'week'],
} as const;
