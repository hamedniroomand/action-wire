import { afterEach, expect, it, vi } from 'vitest';

import { createSessionStore } from '~/agent/session';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('keeps two session stores isolated and frozen', () => {
  const first = createSessionStore();
  const second = createSessionStore();
  first.update((state) => ({ ...state, busy: true }));
  expect(first.getState().busy).toBe(true);
  expect(second.getState().busy).toBe(false);
  expect(first.getState()).not.toBe(second.getState());
  expect(Object.isFrozen(first.getState())).toBe(true);
  expect(Object.isFrozen(first.getState().messages)).toBe(true);
  expect(Object.isFrozen(first.getState().timeline)).toBe(true);
  first.dispose();
  second.dispose();
});

it('resets state on clear and stops notifications after unsubscribe', () => {
  const store = createSessionStore();
  const values: boolean[] = [];
  const unsubscribe = store.subscribe((state) => {
    values.push(state.busy);
  });
  store.update((state) => ({ ...state, busy: true }));
  unsubscribe();
  store.update((state) => ({ ...state, busy: false }));
  store.clear();
  expect(store.getState()).toEqual({
    timeline: [],
    messages: [],
    activities: [],
    busy: false,
  });
  expect(values).toEqual([true]);
  store.dispose();
});

it('does not read or write localStorage, IndexedDB, or cookies', () => {
  const localStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    key: vi.fn(),
    length: 0,
  };
  const indexedDB = { open: vi.fn(), deleteDatabase: vi.fn(), cmp: vi.fn(), databases: vi.fn() };
  const cookie = { get: vi.fn(() => ''), set: vi.fn() };
  vi.stubGlobal('localStorage', localStorage);
  vi.stubGlobal('indexedDB', indexedDB);
  vi.stubGlobal('document', {
    get cookie() {
      return cookie.get();
    },
    set cookie(value: string) {
      cookie.set(value);
    },
  });
  const store = createSessionStore();
  store.update((state) => ({
    ...state,
    busy: true,
    messages: [{ role: 'user', content: 'Hello' }],
    timeline: [{ kind: 'message', index: 0 }],
  }));
  store.clear();
  store.dispose();
  expect(localStorage.getItem).not.toHaveBeenCalled();
  expect(localStorage.setItem).not.toHaveBeenCalled();
  expect(indexedDB.open).not.toHaveBeenCalled();
  expect(cookie.get).not.toHaveBeenCalled();
  expect(cookie.set).not.toHaveBeenCalled();
});
