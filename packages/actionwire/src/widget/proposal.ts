import type { Json, Proposal, ToolDefinition } from '~/core';
import { copyToolArguments, validateToolArguments } from '~/core/arguments';

export type ProposalHandlers = {
  confirm: (id: string, version: number, approved: boolean) => void;
  edit: (id: string, version: number, args: Record<string, Json>) => void;
};

export type ProposalPanel = {
  sync(proposal: Proposal | undefined, tool: ToolDefinition | undefined): void;
};

type FieldKind = 'string' | 'number' | 'boolean' | 'enum' | 'json';

type FieldSpec = {
  key: string;
  label: string;
  kind: FieldKind;
  required: boolean;
  enumValues?: readonly string[];
};

export function createProposalPanel(root: ParentNode, handlers: ProposalHandlers): ProposalPanel {
  const panel = el('div', 'proposal-panel');
  panel.hidden = true;
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', 'Action review');
  root.append(panel);

  let bound: { id: string; version: number } | undefined;
  let toolRef: ToolDefinition | undefined;
  let draft: Record<string, Json> = {};
  let focusedKey: string | undefined;

  const title = text('h2', 'proposal-title', '');
  title.id = 'aw-proposal-title';
  const status = text('p', 'proposal-status muted', '');
  const preview = text('div', 'proposal-preview', '');
  preview.setAttribute('aria-label', 'Application preview');
  const fields = el('div', 'proposal-fields');
  const error = text('p', 'proposal-error', '');
  error.setAttribute('role', 'alert');
  const actions = el('div', 'proposal-actions');
  const apply = text('button', 'tbtn', 'Apply edits');
  apply.type = 'button';
  const exclude = text('button', 'tbtn', 'Exclude');
  exclude.type = 'button';
  const approve = text('button', 'tbtn danger', 'Confirm');
  approve.type = 'button';
  actions.append(apply, exclude, approve);
  panel.append(title, status, preview, fields, error, actions);

  apply.addEventListener('click', () => {
    if (bound === undefined || toolRef === undefined) return;
    const parsed = parseProposalDraft(toolRef, draft);
    if (!parsed.ok) {
      error.textContent = parsed.message;
      error.hidden = false;
      return;
    }
    handlers.edit(bound.id, bound.version, parsed.args);
  });
  exclude.addEventListener('click', () => {
    if (bound === undefined) return;
    handlers.confirm(bound.id, bound.version, false);
  });
  approve.addEventListener('click', () => {
    if (bound === undefined) return;
    handlers.confirm(bound.id, bound.version, true);
  });

  function rememberFocus(): void {
    const active = panel.querySelector('input, textarea, select');
    if (active instanceof HTMLElement) {
      focusedKey = active.getAttribute('data-key') ?? undefined;
    }
  }

  function restoreFocus(): void {
    if (focusedKey === undefined) return;
    const node = panel.querySelector(`[data-key="${focusedKey}"]`);
    if (node instanceof HTMLElement) node.focus();
  }

  return {
    sync(proposal, tool) {
      rememberFocus();
      if (proposal === undefined || tool === undefined) {
        panel.hidden = true;
        bound = undefined;
        toolRef = undefined;
        return;
      }
      toolRef = tool;
      const same =
        bound !== undefined && bound.id === proposal.id && bound.version === proposal.version;
      if (!same) {
        bound = { id: proposal.id, version: proposal.version };
        draft = copyToolArguments(proposal.call.arguments);
      }
      panel.hidden = false;
      title.textContent = proposal.title;
      status.textContent = proposalStatusLabel(proposal);
      preview.textContent = previewText(proposal);
      error.textContent = proposal.reason ?? '';
      error.hidden = proposal.reason === undefined || proposal.reason === '';

      const specs = fieldSpecs(tool.inputSchema);
      fields.replaceChildren();
      if (specs.length === 0 || specs.some((spec) => spec.kind === 'json')) {
        fields.append(jsonField('arguments', 'Inputs (JSON)', draft, specs.length === 0));
      } else {
        for (const spec of specs) {
          fields.append(
            simpleField(spec, draft, (key, value) => {
              draft = { ...draft, [key]: value };
            }),
          );
        }
      }

      const canConfirm = proposal.status === 'ready-for-review';
      approve.disabled = !canConfirm;
      apply.disabled = proposal.status === 'running' || proposal.status === 'succeeded';
      panel.dataset['status'] = proposal.status;
      restoreFocus();
    },
  };
}

function proposalStatusLabel(proposal: Proposal): string {
  if (proposal.status === 'preparing') return 'Preparing this action…';
  if (proposal.status === 'needs-input') return 'Fix the inputs before you can confirm.';
  if (proposal.status === 'ready-for-review') return 'Review the inputs, then confirm or exclude.';
  if (proposal.status === 'approved') return 'Approved. Waiting to run.';
  return proposal.status;
}

function previewText(proposal: Proposal): string {
  const p = proposal.preview;
  if (p === undefined) return '';
  if (p.kind === 'application') return p.text;
  if (p.kind === 'unavailable') return p.reason;
  return p.reason;
}

function fieldSpecs(schema: Record<string, Json>): FieldSpec[] {
  if (schema.type !== 'object') return [];
  const properties = schema.properties;
  if (typeof properties !== 'object' || properties === null || Array.isArray(properties)) return [];
  const required = new Set(
    Array.isArray(schema.required)
      ? schema.required.filter((entry): entry is string => typeof entry === 'string')
      : [],
  );
  const specs: FieldSpec[] = [];
  for (const [key, raw] of Object.entries(properties)) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      specs.push({ key, label: key, kind: 'json', required: required.has(key) });
      continue;
    }
    const type = raw.type;
    if (raw.enum !== undefined && Array.isArray(raw.enum)) {
      const enumValues = raw.enum.filter((v): v is string => typeof v === 'string');
      specs.push({ key, label: key, kind: 'enum', required: required.has(key), enumValues });
      continue;
    }
    if (type === 'boolean') {
      specs.push({ key, label: key, kind: 'boolean', required: required.has(key) });
      continue;
    }
    if (type === 'integer' || type === 'number') {
      specs.push({ key, label: key, kind: 'number', required: required.has(key) });
      continue;
    }
    if (type === 'string') {
      specs.push({ key, label: key, kind: 'string', required: required.has(key) });
      continue;
    }
    specs.push({ key, label: key, kind: 'json', required: required.has(key) });
  }
  if (specs.some((spec) => spec.kind === 'json'))
    return [{ key: '__json', label: 'Inputs', kind: 'json', required: true }];
  return specs;
}

function simpleField(
  spec: FieldSpec,
  draft: Record<string, Json>,
  onChange: (key: string, value: Json) => void,
): HTMLElement {
  const row = el('label', 'proposal-field');
  const name = text('span', 'proposal-label', spec.label);
  row.append(name);
  const value = draft[spec.key];
  if (spec.kind === 'boolean') {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = value === true;
    input.dataset['key'] = spec.key;
    input.addEventListener('change', () => onChange(spec.key, input.checked));
    row.append(input);
    return row;
  }
  if (spec.kind === 'enum' && spec.enumValues !== undefined) {
    const select = document.createElement('select');
    select.dataset['key'] = spec.key;
    for (const optionValue of spec.enumValues) {
      const option = document.createElement('option');
      option.value = optionValue;
      option.textContent = optionValue;
      select.append(option);
    }
    if (typeof value === 'string') select.value = value;
    select.addEventListener('change', () => onChange(spec.key, select.value));
    row.append(select);
    return row;
  }
  const input = document.createElement('input');
  input.dataset['key'] = spec.key;
  if (spec.kind === 'number') {
    input.type = 'number';
    if (typeof value === 'number') input.value = String(value);
  } else {
    input.type = 'text';
    if (typeof value === 'string') input.value = value;
  }
  input.addEventListener('input', () => {
    if (spec.kind === 'number') {
      if (input.value.trim() === '') onChange(spec.key, null);
      else {
        const parsed = Number(input.value);
        if (Number.isFinite(parsed)) onChange(spec.key, parsed);
      }
      return;
    }
    onChange(spec.key, input.value);
  });
  row.append(input);
  return row;
}

function jsonField(
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
    try {
      const parsed: unknown = JSON.parse(area.value);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        for (const [entryKey, value] of Object.entries(parsed)) {
          if (
            typeof value === 'string' ||
            typeof value === 'number' ||
            typeof value === 'boolean' ||
            value === null
          ) {
            draft[entryKey] = value;
          }
        }
      }
    } catch {
      // Keep local draft until Apply; bridge validates on edit.
    }
  });
  row.append(area);
  return row;
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

function el(tag: string, className: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function text<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  content: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = content;
  return node;
}
