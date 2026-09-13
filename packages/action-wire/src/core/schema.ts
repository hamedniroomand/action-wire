import type { SchemaValidators } from '~/core/ajv';
import { AgentError } from '~/core/errors';
import type { Json } from '~/core/types';

const DRAFT_7 = 'http://json-schema.org/draft-07/schema#';
const DRAFT_2020 = 'https://json-schema.org/draft/2020-12/schema';

export function createSchemaValidator(validators: SchemaValidators) {
  return (schema: Record<string, Json>): void => {
    if (schema['type'] !== 'object') {
      throw new AgentError('INVALID_SCHEMA', 'The tool input schema must have type object.');
    }
    const dialect = schema['$schema'];
    if (dialect !== undefined && dialect !== DRAFT_7 && dialect !== DRAFT_2020) {
      throw new AgentError('INVALID_SCHEMA', 'Use JSON Schema draft-07 or draft 2020-12.');
    }
    const validator = dialect === DRAFT_7 ? validators.draft7 : validators.draft2020;
    if (!validator.validateSchema(schema)) {
      throw new AgentError('INVALID_SCHEMA', validator.errorsText());
    }
  };
}
