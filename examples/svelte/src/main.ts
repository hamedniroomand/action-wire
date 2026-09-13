import { mount } from 'svelte';

import App from './App.svelte';

const root = document.querySelector('#app');
if (!(root instanceof HTMLElement)) throw new Error('The app root is missing.');
mount(App, { target: root });
