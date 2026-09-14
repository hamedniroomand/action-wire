import type { Confirmation, ConfirmationPolicy, ToolCall, ToolDefinition } from '~/core';

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
  return {
    id: call.id,
    call,
    revision,
    title: tool.title ?? tool.name,
    confirmLabel: 'Confirm',
  };
}
