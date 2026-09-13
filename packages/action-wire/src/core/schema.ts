import { Validator } from '@cfworker/json-schema';
import type { OutputUnit } from '@cfworker/json-schema';

import { AgentError } from '~/core/errors';
import { DRAFT_2020, DRAFT_7, STRUCTURE_META } from '~/core/meta-schemas';
import type { Json } from '~/core/types';

// ponytail: Both dialects are checked against the draft-07 meta-schema. The
// 2020-12 meta-schema recurses with `$dynamicRef`, which the validator does not
// follow, so nested subschemas would go unchecked. Draft-07 recurses with a
// plain `$ref`, and it treats 2020-12-only keywords as unknown and allowed.
// Switch to the 2020-12 meta-schema when `$dynamicRef` resolution lands.
export function createSchemaValidator() {
  const structure = new Validator(STRUCTURE_META, '7');
  return (schema: Record<string, Json>): void => {
    if (schema['type'] !== 'object') {
      throw new AgentError('INVALID_SCHEMA', 'The tool input schema must have type object.');
    }
    const dialect = schema['$schema'];
    if (dialect !== undefined && dialect !== DRAFT_7 && dialect !== DRAFT_2020) {
      throw new AgentError('INVALID_SCHEMA', 'Use JSON Schema draft-07 or draft 2020-12.');
    }
    const result = structure.validate(schema);
    if (!result.valid) throw new AgentError('INVALID_SCHEMA', describe(result.errors));
  };
}

function describe(errors: readonly OutputUnit[]): string {
  return errors.map((unit) => `${unit.instanceLocation} ${unit.error}`).join(', ');
}
