import { createApp } from 'vue';

import App from './App.vue';

const root = document.querySelector('#app');
if (!(root instanceof HTMLElement)) throw new Error('The app root is missing.');
createApp(App).mount(root);
