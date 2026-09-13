import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';

const root = document.querySelector('#root');
if (!(root instanceof HTMLElement)) throw new Error('The app root is missing.');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
