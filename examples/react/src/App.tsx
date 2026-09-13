import { openAICompatible } from '@action-wire/agent';
import { createAssistant } from 'action-wire';
import { useEffect, useRef, useState } from 'react';

export function App() {
  const [mounted, setMounted] = useState(true);
  const [label, setLabel] = useState('idle');
  return (
    <main>
      <h1>React host</h1>
      <p>Status: {label}</p>
      {mounted ? (
        <button
          type="button"
          onClick={() => setMounted(false)}
        >
          Unmount
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setMounted(true)}
        >
          Mount
        </button>
      )}
      {mounted ? (
        <AssistantSession
          label={label}
          onLabel={setLabel}
        />
      ) : null}
    </main>
  );
}

function AssistantSession(props: { label: string; onLabel: (value: string) => void }) {
  const labelRef = useRef(props.label);
  const onLabelRef = useRef(props.onLabel);
  labelRef.current = props.label;
  onLabelRef.current = props.onLabel;

  useEffect(() => {
    const registration = new AbortController();
    const assistant = createAssistant({
      model: openAICompatible({ endpoint: '/api/assistant' }),
    });
    const context = nativeContext();
    if (context === undefined) {
      return () => {
        assistant.dispose();
      };
    }
    void context
      .registerTool(
        {
          name: 'setStatus',
          description: 'Set the visible host status from current React state.',
          inputSchema: {
            type: 'object',
            additionalProperties: false,
            properties: { name: { type: 'string' } },
            required: ['name'],
          },
          annotations: { readOnlyHint: false, consequentialHint: false },
          execute: async (input: unknown) => {
            const next = readName(input) ?? `${labelRef.current}-done`;
            onLabelRef.current(next);
            return { text: next };
          },
        },
        { signal: registration.signal },
      )
      .then(() => {
        if (registration.signal.aborted) return undefined;
        assistant.mount();
        return undefined;
      })
      .catch((error: unknown) => {
        if (isAbort(error) || registration.signal.aborted) return undefined;
        throw error;
      });
    return () => {
      assistant.dispose();
      registration.abort();
    };
  }, []);

  return null;
}

type NativeContext = {
  registerTool(tool: object, options?: { signal: AbortSignal }): Promise<void>;
};

function nativeContext(): NativeContext | undefined {
  const value = Reflect.get(document, 'modelContext');
  if (!isNativeContext(value)) return undefined;
  return value;
}

function isNativeContext(value: unknown): value is NativeContext {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'registerTool') === 'function'
  );
}

function readName(input: unknown): string | undefined {
  const record = asRecord(input);
  const name = record['name'];
  return typeof name === 'string' ? name : undefined;
}

function isAbort(error: unknown): boolean {
  return typeof error === 'object' && error !== null && Reflect.get(error, 'name') === 'AbortError';
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    try {
      return asRecord(JSON.parse(value));
    } catch {
      return {};
    }
  }
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return Object.fromEntries(Object.entries(value));
  }
  return {};
}
