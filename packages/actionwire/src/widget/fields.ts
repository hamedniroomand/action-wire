import type { Json, ToolDefinition } from '~/core';
import { copyToolArguments, validateToolArguments } from '~/core/arguments';
import { el, text } from '~/widget/dom';

export type FieldKind = 'string' | 'number' | 'boolean' | 'enum' | 'json';

export type FieldSpec = {
  key: string;
  label: string;
  kind: FieldKind;
  required: boolean;
  enumValues?: readonly string[];
};

export function fieldSpecs(schema: Record<string, Json>): FieldSpec[] {
  if (schema['type'] !== 'object') return [];
  const properties = schema['properties'];
  if (typeof properties !== 'object' || properties === null || Array.isArray(properties)) return [];
  const required = new Set(
    Array.isArray(schema['required'])
      ? schema['required'].filter((entry): entry is string => typeof entry === 'string')
      : [],
  );
  const specs = Object.entries(properties).map(([key, raw]) => toSpec(key, raw, required.has(key)));
  if (specs.some((spec) => spec.kind === 'json')) {
    return [{ key: '__json', label: 'Inputs', kind: 'json', required: true }];
  }
  return specs;
}

function toSpec(key: string, raw: Json, required: boolean): FieldSpec {
  const base = { key, label: key, required };
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ...base, kind: 'json' };
  }
  if (Array.isArray(raw['enum'])) {
    const enumValues = raw['enum'].filter((value): value is string => typeof value === 'string');
    return { ...base, kind: 'enum', enumValues };
  }
  const type = raw['type'];
  if (type === 'boolean') return { ...base, kind: 'boolean' };
  if (type === 'integer' || type === 'number') return { ...base, kind: 'number' };
  if (type === 'string') return { ...base, kind: 'string' };
  return { ...base, kind: 'json' };
}

export function simpleField(
  spec: FieldSpec,
  draft: Record<string, Json>,
  onChange: (key: string, value: Json) => void,
): HTMLElement {
  const row = el('label', 'proposal-field');
  row.append(text('span', 'proposal-label', spec.label));
  row.append(control(spec, draft[spec.key], onChange));
  return row;
}

function control(
  spec: FieldSpec,
  value: Json | undefined,
  onChange: (key: string, value: Json) => void,
): HTMLElement {
  if (spec.kind === 'boolean') return checkbox(spec.key, value === true, onChange);
  if (spec.kind === 'enum' && spec.enumValues !== undefined) {
    return dropdown(spec.key, spec.enumValues, value, onChange);
  }
  return textbox(spec.key, spec.kind === 'number', value, onChange);
}

function checkbox(
  key: string,
  checked: boolean,
  onChange: (key: string, value: Json) => void,
): HTMLElement {
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  input.dataset['key'] = key;
  input.addEventListener('change', () => onChange(key, input.checked));
  return input;
}

function dropdown(
  key: string,
  values: readonly string[],
  value: Json | undefined,
  onChange: (key: string, value: Json) => void,
): HTMLElement {
  const select = document.createElement('select');
  select.dataset['key'] = key;
  for (const optionValue of values) {
    const option = document.createElement('option');
    option.value = optionValue;
    option.textContent = optionValue;
    select.append(option);
  }
  if (typeof value === 'string') select.value = value;
  select.addEventListener('change', () => onChange(key, select.value));
  return select;
}

function textbox(
  key: string,
  numeric: boolean,
  value: Json | undefined,
  onChange: (key: string, value: Json) => void,
): HTMLElement {
  const input = document.createElement('input');
  input.dataset['key'] = key;
  input.type = numeric ? 'number' : 'text';
  if (numeric) {
    if (typeof value === 'number') input.value = String(value);
  } else if (typeof value === 'string') {
    input.value = value;
  }
  input.addEventListener('input', () => {
    if (!numeric) {
      onChange(key, input.value);
      return;
    }
    if (input.value.trim() === '') {
      onChange(key, null);
      return;
    }
    const parsed = Number(input.value);
    if (Number.isFinite(parsed)) onChange(key, parsed);
  });
  return input;
}

export function jsonField(
  key: string,
  label: string,
  draft: Record<string, Json>,
  wholeObject: boolean,
): HTMLElement {
  const row = el('label', 'proposal-field');
  row.append(text('span', 'proposal-label', label));
  const area = document.createElement('textarea');
  area.className = 'proposal-json';
  area.dataset['key'] = key;
  area.rows = 4;
  area.value = JSON.stringify(wholeObject ? draft : draft[key], null, 2);
  area.addEventListener('input', () => {
    mergeScalars(draft, area.value);
  });
  row.append(area);
  return row;
}

/** Keeps the local draft until Apply; the bridge validates on edit. */
function mergeScalars(draft: Record<string, Json>, source: string): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    return;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return;
  for (const [key, value] of Object.entries(parsed)) {
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null
    ) {
      draft[key] = value;
    }
  }
}

export function parseProposalDraft(
  tool: ToolDefinition,
  draft: Record<string, Json>,
): { ok: true; args: Record<string, Json> } | { ok: false; message: string } {
  const args = copyToolArguments(draft);
  if (!validateToolArguments(tool.inputSchema, args)) {
    return { ok: false, message: 'The inputs do not match the tool schema.' };
  }
  return { ok: true, args };
}
