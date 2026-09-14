import { Validator } from '@cfworker/json-schema';

import { AgentError } from '~/core/errors';
import { copyJson } from '~/core/json';
import { DRAFT_2020, DRAFT_7 } from '~/core/meta-schemas';
import type { Json } from '~/core/types';

export function copyToolArguments(args: Record<string, Json>): Record<string, Json> {
  const copied = copyJson(args);
  if (typeof copied !== 'object' || copied === null || Array.isArray(copied)) {
    throw new AgentError('INVALID_ARGUMENTS', 'Tool arguments must be a JSON object.');
  }
  return copied;
}

export function validateToolArguments(
  schema: Record<string, Json>,
  data: Record<string, Json>,
): boolean {
  const dialect = schema['$schema'];
  if (dialect !== undefined && dialect !== DRAFT_7 && dialect !== DRAFT_2020) return false;
  const mutable = copyJson(schema);
  if (typeof mutable !== 'object' || mutable === null || Array.isArray(mutable)) return false;
  const validator = new Validator(mutable, dialect === DRAFT_7 ? '7' : '2020-12');
  return validator.validate(data).valid;
}
