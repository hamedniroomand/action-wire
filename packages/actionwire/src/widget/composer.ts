import { sendIcon } from '~/widget/icons';

export function createComposer(send: (text: string) => void): {
  root: HTMLElement;
  setBusy: (busy: boolean) => void;
} {
  const field = document.createElement('textarea');
  field.setAttribute('aria-label', 'Message');
  field.rows = 1;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'send';
  button.setAttribute('aria-label', 'Send');
  button.append(sendIcon());
  const root = document.createElement('div');
  root.className = 'composer';
  root.append(field, button);

  function submit(): void {
    const text = field.value.trim();
    if (text === '' || button.disabled) return;
    field.value = '';
    send(text);
  }

  field.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    if (event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    submit();
  });
  button.addEventListener('click', () => {
    submit();
  });

  return {
    root,
    setBusy(busy) {
      button.disabled = busy;
    },
  };
}
