import { runProbe } from './probe';

const button = document.querySelector<HTMLButtonElement>('#run')!;
const output = document.querySelector<HTMLPreElement>('#report')!;
button.addEventListener('click', async () => {
  button.disabled = true;
  output.textContent = 'Running';
  try {
    output.textContent = JSON.stringify(await runProbe(), null, 2);
  } finally {
    button.disabled = false;
  }
});
