export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className !== '') node.className = className;
  return node;
}

export function text<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  content: string,
): HTMLElementTagNameMap[K] {
  const node = el(tag, className);
  node.textContent = content;
  return node;
}

export function button(label: string, onClick: () => void, className = ''): HTMLButtonElement {
  const node = text('button', className, label);
  node.type = 'button';
  node.addEventListener('click', onClick);
  return node;
}

export function field(name: string, label: string, placeholder = ''): HTMLInputElement {
  const node = el('input');
  node.name = name;
  node.required = true;
  node.setAttribute('aria-label', label);
  if (placeholder !== '') node.placeholder = placeholder;
  return node;
}

export function submitButton(label: string): HTMLButtonElement {
  const node = text('button', '', label);
  node.type = 'submit';
  return node;
}

export function heading(title: string, subtitle: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  fragment.append(text('h1', '', title), text('p', 'lede', subtitle));
  return fragment;
}

export function listItem(label: string, onClick: () => void, meta?: string): HTMLLIElement {
  const item = el('li');
  const action = meta === undefined ? button(label, onClick) : button('', onClick);
  if (meta !== undefined) {
    action.append(text('span', '', label), text('span', 'meta', meta));
  }
  item.append(action);
  return item;
}

export function readError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'The action failed.';
}
