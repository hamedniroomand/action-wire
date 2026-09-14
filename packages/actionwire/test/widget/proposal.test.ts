import { expect, it } from 'vitest';

import type { ToolDefinition } from '~/core';
import { parseProposalDraft } from '~/widget/fields';

const tool: ToolDefinition = {
  id: 'write',
  name: 'write',
  description: 'Write',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      week: { type: 'integer' },
      live: { type: 'boolean' },
    },
    required: ['title', 'week'],
  },
};

it('preserves JSON types when parsing a draft', () => {
  const parsed = parseProposalDraft(tool, { title: 'Q1', week: 3, live: true });
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) return;
  expect(parsed.args).toEqual({ title: 'Q1', week: 3, live: true });
});

it('rejects drafts that do not match the schema', () => {
  expect(parseProposalDraft(tool, { title: 'Q1', week: 'bad' }).ok).toBe(false);
});

it('copies draft values so caller mutation does not change parsed args', () => {
  const draft = { title: 'Q1', week: 2 };
  const parsed = parseProposalDraft(tool, draft);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) return;
  draft.title = 'Changed';
  expect(parsed.args.title).toBe('Q1');
});
