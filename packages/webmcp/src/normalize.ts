import { AgentError } from '@action-wire/core';
import type { Json, ToolDefinition } from '@action-wire/core';

import type { NativeRegisteredTool } from '~/native';

export type NativeEncoding = 'json-string' | 'object';

export type NormalizedNativeTool = {
  definition: ToolDefinition;
  native: NativeRegisteredTool;
  encoding: NativeEncoding;
};

export function normalizeNativeTool(tool: NativeRegisteredTool): NormalizedNativeTool {
  const name = Reflect.get(tool, 'name');
  const description = Reflect.get(tool, 'description');
  if (typeof name !== 'string' || !name.trim()) {
    throw new AgentError('INVALID_SCHEMA', 'Each current-document tool must have a name.');
  }
  if (typeof description !== 'string' || !description.trim()) {
    throw new AgentError('INVALID_SCHEMA', 'Each current-document tool must have a description.');
  }
  const { schema, encoding } = parseSchema(Reflect.get(tool, 'inputSchema'));
  const definition: ToolDefinition = {
    id: name,
    name,
    description,
    inputSchema: schema,
  };
  const annotations = Reflect.get(tool, 'annotations');
  if (typeof annotations === 'object' && annotations !== null) {
    const readOnly = Reflect.get(annotations, 'readOnlyHint');
    if (typeof readOnly === 'boolean') definition.readOnly = readOnly;
    const consequential = Reflect.get(annotations, 'consequentialHint');
    if (typeof consequential === 'boolean') definition.consequential = consequential;
  }
  return { definition, native: tool, encoding };
}

function parseSchema(input: unknown): {
  schema: Record<string, Json>;
  encoding: NativeEncoding;
} {
  if (typeof input === 'string') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(input);
    } catch (error) {
      throw new AgentError('INVALID_SCHEMA', 'The tool input schema is not valid JSON.', {
        cause: error,
      });
    }
    return { schema: asSchemaObject(parsed), encoding: 'json-string' };
  }
  return { schema: asSchemaObject(input), encoding: 'object' };
}

function asSchemaObject(value: unknown): Record<string, Json> {
  if (!isJson(value) || value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgentError('INVALID_SCHEMA', 'The tool input schema must be an object.');
  }
  return value;
}

function isJson(value: unknown): value is Json {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJson);
  if (typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return false;
  return Object.values(value).every(isJson);
}
