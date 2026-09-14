import { expect, it } from 'vitest';

import { hotkeyLabel, isMacPlatform, isToggleKey } from '~/widget/hotkey';
import type { KeyLike } from '~/widget/hotkey';

function key(over: Partial<KeyLike>): KeyLike {
  return {
    key: '/',
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    defaultPrevented: false,
    isComposing: false,
    ...over,
  };
}

it('matches ⌘/ on macOS and Ctrl+/ elsewhere', () => {
  expect(isToggleKey(key({ metaKey: true }), true)).toBe(true);
  expect(isToggleKey(key({ ctrlKey: true }), true)).toBe(false);
  expect(isToggleKey(key({ ctrlKey: true }), false)).toBe(true);
  expect(isToggleKey(key({ metaKey: true }), false)).toBe(false);
});

it('ignores handled, composing, alt, and other keys', () => {
  expect(isToggleKey(key({ metaKey: true, defaultPrevented: true }), true)).toBe(false);
  expect(isToggleKey(key({ metaKey: true, isComposing: true }), true)).toBe(false);
  expect(isToggleKey(key({ metaKey: true, altKey: true }), true)).toBe(false);
  expect(isToggleKey(key({ metaKey: true, key: '.' }), true)).toBe(false);
});

it('detects the platform and labels the key', () => {
  expect(isMacPlatform('MacIntel')).toBe(true);
  expect(isMacPlatform('Win32')).toBe(false);
  expect(hotkeyLabel(true)).toBe('⌘/');
  expect(hotkeyLabel(false)).toBe('Ctrl+/');
});
