import { AgentError } from './errors.js';
import { copyJson, freeze } from './json.js';
import { createSchemaValidator } from './schema.js';
import type { ToolDefinition, ToolSnapshot } from './types.js';

export function createToolRegistry() {
  let snapshot: ToolSnapshot = freeze({ revision: 0, tools: [] });
  let fingerprint = '[]';
  const validateSchema = createSchemaValidator();

  return {
    getSnapshot: (): ToolSnapshot => snapshot,
    replace(tools: readonly ToolDefinition[]): ToolSnapshot {
      const ids = new Set<string>();
      const names = new Set<string>();
      const next = tools.map((tool) => {
        if (
          !tool ||
          [tool.id, tool.name, tool.description].some(
            (value) => typeof value !== 'string' || !value.trim(),
          )
        ) {
          throw new AgentError(
            'INVALID_SCHEMA',
            'Tool ID, name, and description must contain text.',
          );
        }
        if (ids.has(tool.id) || names.has(tool.name)) {
          throw new AgentError('INVALID_SCHEMA', 'Tool IDs and names must be unique.');
        }
        ids.add(tool.id);
        names.add(tool.name);
        const schema = copyJson(tool.inputSchema);
        if (schema === null || typeof schema !== 'object' || Array.isArray(schema)) {
          throw new AgentError('INVALID_SCHEMA', 'The tool input schema must be an object.');
        }
        validateSchema(schema);
        const copy: ToolDefinition = {
          id: tool.id,
          name: tool.name,
          description: tool.description,
          inputSchema: schema,
        };
        for (const key of ['readOnly', 'consequential'] as const) {
          if (tool[key] !== undefined) {
            if (typeof tool[key] !== 'boolean')
              throw new AgentError('INVALID_SCHEMA', 'Tool hints must be boolean.');
            copy[key] = tool[key];
          }
        }
        return copy;
      });
      const nextFingerprint = JSON.stringify(next);
      if (nextFingerprint !== fingerprint) {
        snapshot = freeze({ revision: snapshot.revision + 1, tools: next });
        fingerprint = nextFingerprint;
      }
      return snapshot;
    },
  };
}
