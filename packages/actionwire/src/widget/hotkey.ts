export type KeyLike = Pick<
  KeyboardEvent,
  'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'defaultPrevented' | 'isComposing'
>;

export function isToggleKey(event: KeyLike, mac: boolean): boolean {
  if (event.defaultPrevented || event.isComposing || event.altKey || event.key !== '/') {
    return false;
  }
  return mac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
}

// navigator.platform is deprecated. It is still the only synchronous signal.
export function isMacPlatform(platform: string = navigator.platform): boolean {
  return /Mac|iPhone|iPad|iPod/.test(platform);
}

export function hotkeyLabel(mac: boolean): string {
  return mac ? '⌘/' : 'Ctrl+/';
}

export function listenToggle(
  target: Document,
  onToggle: () => void,
  mac: boolean = isMacPlatform(),
): () => void {
  const handler = (event: KeyboardEvent): void => {
    if (!isToggleKey(event, mac)) return;
    event.preventDefault();
    onToggle();
  };
  target.addEventListener('keydown', handler);
  return () => {
    target.removeEventListener('keydown', handler);
  };
}
