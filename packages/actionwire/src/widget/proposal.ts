import type { Json, Proposal, ToolDefinition } from '~/core';
import { copyToolArguments } from '~/core/arguments';
import { el, text, textButton } from '~/widget/dom';
import { fieldSpecs, jsonField, parseProposalDraft, simpleField } from '~/widget/fields';

export type ProposalHandlers = {
  confirm: (id: string, version: number, approved: boolean) => void;
  edit: (id: string, version: number, args: Record<string, Json>) => void;
};

export type ProposalPanel = {
  /** Returns true when the panel is on screen and owns the review controls. */
  sync(proposal: Proposal | undefined, tool: ToolDefinition | undefined): boolean;
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
  const apply = textButton('tbtn', 'Apply edits');
  const exclude = textButton('tbtn', 'Exclude');
  const approve = textButton('tbtn danger', 'Confirm');
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
    if (bound !== undefined) handlers.confirm(bound.id, bound.version, false);
  });
  approve.addEventListener('click', () => {
    if (bound !== undefined) handlers.confirm(bound.id, bound.version, true);
  });

  function rememberFocus(): void {
    const active = panel.querySelector('input, textarea, select');
    if (active instanceof HTMLElement) focusedKey = active.getAttribute('data-key') ?? undefined;
  }

  function restoreFocus(): void {
    if (focusedKey === undefined) return;
    const node = panel.querySelector(`[data-key="${focusedKey}"]`);
    if (node instanceof HTMLElement) node.focus();
  }

  function renderFields(tool: ToolDefinition): void {
    const specs = fieldSpecs(tool.inputSchema);
    fields.replaceChildren();
    if (specs.length === 0 || specs.some((spec) => spec.kind === 'json')) {
      fields.append(jsonField('arguments', 'Inputs (JSON)', draft, specs.length === 0));
      return;
    }
    for (const spec of specs) {
      fields.append(
        simpleField(spec, draft, (key, value) => {
          draft[key] = value;
        }),
      );
    }
  }

  return {
    sync(proposal, tool) {
      rememberFocus();
      if (proposal === undefined || tool === undefined) {
        panel.hidden = true;
        bound = undefined;
        toolRef = undefined;
        return false;
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
      status.textContent = statusLabel(proposal);
      preview.textContent = previewText(proposal);
      error.textContent = proposal.reason ?? '';
      error.hidden = proposal.reason === undefined || proposal.reason === '';
      renderFields(tool);
      approve.disabled = proposal.status !== 'ready-for-review';
      apply.disabled = proposal.status === 'running' || proposal.status === 'succeeded';
      panel.dataset['status'] = proposal.status;
      restoreFocus();
      return true;
    },
  };
}

function statusLabel(proposal: Proposal): string {
  if (proposal.status === 'preparing') return 'Preparing this action…';
  if (proposal.status === 'needs-input') return 'Fix the inputs before you can confirm.';
  if (proposal.status === 'ready-for-review') return 'Review the inputs, then confirm or exclude.';
  if (proposal.status === 'approved') return 'Approved. Waiting to run.';
  return proposal.status;
}

function previewText(proposal: Proposal): string {
  if (proposal.preview === undefined) return '';
  if (proposal.preview.kind === 'application') return proposal.preview.text;
  return proposal.preview.reason;
}
