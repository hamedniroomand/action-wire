import type { ConfirmationPolicy, ToolCall, ToolDefinition } from '~/core';

export function needsConfirmation(
  tool: ToolDefinition,
  call: ToolCall,
  policy?: ConfirmationPolicy,
): boolean {
  if (tool.consequential === true) return true;
  if (policy?.(tool, call) === true) return true;
  return tool.readOnly !== true;
}
