import type { Ajv } from 'ajv';

export type SchemaValidators = { draft7: Ajv; draft2020: Ajv };

const OPTIONS = { strict: false, allErrors: true } as const;

let pending: Promise<SchemaValidators> | undefined;

// ponytail: Ajv is 41kB gzipped, so it loads on first use instead of at import.
// The promise is cached, so later calls resolve without another network round trip.
export function loadSchemaValidators(): Promise<SchemaValidators> {
  pending ??= Promise.all([import('ajv'), import('#ajv/2020')]).then(([core, next]) => ({
    draft7: new core.Ajv(OPTIONS),
    draft2020: new next.Ajv2020(OPTIONS),
  }));
  return pending;
}
