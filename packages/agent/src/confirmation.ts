import type { Confirmation, ConfirmationPolicy, ToolCall, ToolDefinition } from '@action-wire/core';

export function needsConfirmation(
  tool: ToolDefinition,
  call: ToolCall,
  policy?: ConfirmationPolicy,
): boolean {
  if (tool.consequential === true) return true;
  if (policy?.(tool, call) === true) return true;
  return tool.readOnly !== true;
}

export function buildConfirmation(
  tool: ToolDefinition,
  call: ToolCall,
  revision: number,
): Confirmation {
  const target = call.arguments['name'];
  const deleting = tool.name.toLowerCase().includes('delete');
  return {
    id: call.id,
    call,
    revision,
    title: typeof target === 'string' ? `${tool.name} ${target}` : tool.name,
    confirmLabel: deleting ? 'Delete' : 'Confirm',
  };
}
