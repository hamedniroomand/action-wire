export function el(tag: string, className: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

export function text<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  content: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = content;
  return node;
}

export function button(className: string, label?: string): HTMLButtonElement {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = className;
  if (label !== undefined) node.setAttribute('aria-label', label);
  return node;
}

export function textButton(className: string, content: string): HTMLButtonElement {
  const node = button(className);
  node.textContent = content;
  return node;
}

/** Returns the existing child with this class, or appends a new one. */
export function child(parent: HTMLElement, className: string, tag = 'span'): HTMLElement {
  const existing = parent.querySelector(`.${className}`);
  if (existing instanceof HTMLElement) return existing;
  const node = el(tag, className);
  parent.append(node);
  return node;
}
