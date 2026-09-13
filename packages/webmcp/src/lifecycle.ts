import type { NativeModelContext } from '~/native';

const TOOL_CHANGE = 'toolchange';

export function listenForToolChange(context: NativeModelContext, onChange: () => void): () => void {
  context.addEventListener(TOOL_CHANGE, onChange);
  return () => {
    context.removeEventListener(TOOL_CHANGE, onChange);
  };
}

export function createGeneration() {
  let current = 0;
  return {
    next() {
      current += 1;
      return current;
    },
    isCurrent(token: number) {
      return token === current;
    },
  };
}
