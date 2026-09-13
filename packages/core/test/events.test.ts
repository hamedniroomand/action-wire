import { expect, it } from 'vitest';

import { createEmitter } from '../src/index.js';

it('continues delivery after a listener throws and supports unsubscribe and clear', () => {
  const emitter = createEmitter<number>();
  const values: number[] = [];
  emitter.subscribe(() => {
    throw new Error('Listener failed');
  });
  const unsubscribe = emitter.subscribe((value) => {
    values.push(value);
  });
  expect(() => emitter.emit(1)).not.toThrow();
  unsubscribe();
  unsubscribe();
  emitter.emit(2);
  emitter.subscribe((value) => {
    values.push(value);
  });
  emitter.clear();
  emitter.emit(3);
  expect(values).toEqual([1]);
});

it('treats repeated subscriptions as separate subscriptions', () => {
  const emitter = createEmitter<string>();
  const values: string[] = [];
  const listener = (value: string) => {
    values.push(value);
  };
  const unsubscribe = emitter.subscribe(listener);
  emitter.subscribe(listener);
  unsubscribe();
  emitter.emit('second');
  expect(values).toEqual(['second']);
});

it('does not call a removed listener or a newly added listener during delivery', () => {
  const emitter = createEmitter<number>();
  const values: number[] = [];
  let remove: () => void;
  emitter.subscribe(() => {
    remove();
    emitter.subscribe((value) => {
      values.push(value);
    });
  });
  remove = emitter.subscribe((value) => {
    values.push(value * 10);
  });
  emitter.emit(1);
  expect(values).toEqual([]);
  emitter.emit(2);
  expect(values).toEqual([2]);
});
