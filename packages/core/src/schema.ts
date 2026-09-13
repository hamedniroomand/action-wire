import { Ajv } from 'ajv';
import { Ajv2020 } from 'ajv/dist/2020.js';

import { AgentError } from './errors.js';
import type { Json } from './types.js';

export function createSchemaValidator() {
  const draft7 = new Ajv({ strict: false, allErrors: true });
  const draft2020 = new Ajv2020({ strict: false, allErrors: true });
  return (schema: Record<string, Json>): void => {
    if (schema['type'] !== 'object') {
      throw new AgentError('INVALID_SCHEMA', 'The tool input schema must have type object.');
    }
    const dialect = schema['$schema'];
    const validator = dialect === 'http://json-schema.org/draft-07/schema#' ? draft7 : draft2020;
    if (
      dialect !== undefined &&
      dialect !== 'http://json-schema.org/draft-07/schema#' &&
      dialect !== 'https://json-schema.org/draft/2020-12/schema'
    ) {
      throw new AgentError('INVALID_SCHEMA', 'Use JSON Schema draft-07 or draft 2020-12.');
    }
    if (!validator.validateSchema(schema)) {
      throw new AgentError('INVALID_SCHEMA', validator.errorsText());
    }
  };
}
