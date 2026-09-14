/** Describes a rejected payload for the debug log without printing the whole body. */
export function describePayload(payload: unknown): Record<string, unknown> {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return { kind: Array.isArray(payload) ? 'array' : typeof payload };
  }
  const choices = Reflect.get(payload, 'choices');
  const error = Reflect.get(payload, 'error');
  const choice = Array.isArray(choices) ? choices[0] : undefined;
  const message = isObject(choice) ? Reflect.get(choice, 'message') : undefined;
  const toolCalls = isObject(message) ? Reflect.get(message, 'tool_calls') : undefined;
  return {
    keys: Object.keys(payload),
    choicesLength: Array.isArray(choices) ? choices.length : null,
    errorMessage: isObject(error) ? Reflect.get(error, 'message') : undefined,
    messageKeys: isObject(message) && !Array.isArray(message) ? Object.keys(message) : undefined,
    contentKind: isObject(message) ? contentKind(Reflect.get(message, 'content')) : undefined,
    toolCallsLength: Array.isArray(toolCalls) ? toolCalls.length : null,
    reasoningContent: isObject(message) ? Reflect.has(message, 'reasoning_content') : false,
  };
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

function contentKind(content: unknown): string {
  if (content === null || content === undefined) return 'empty';
  if (typeof content === 'string') return 'string';
  if (Array.isArray(content)) return 'array';
  return typeof content;
}
