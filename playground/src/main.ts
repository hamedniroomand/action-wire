import { mountAssistant } from './assistant';
import { createProjects } from './projects';
import { registerDashboardTools } from './tools';

const projects = createProjects();
const root = document.querySelector('#app');
if (!(root instanceof HTMLElement)) throw new Error('The app root is missing.');
const app = root;

void registerDashboardTools(projects)
  .catch(() => undefined)
  .finally(() => {
    mountAssistant();
  });

function render(): void {
  app.replaceChildren(sidebar(), content());
}

function sidebar(): HTMLElement {
  const nav = document.createElement('nav');
  nav.className = 'sidebar';
  nav.setAttribute('aria-label', 'Application');
  const brand = document.createElement('p');
  brand.className = 'brand';
  brand.textContent = 'Acme Project';
  nav.append(
    brand,
    navButton('Projects', 'list', () => projects.openList()),
    navButton('Billing', 'billing', () => projects.openBilling()),
    navButton('Settings', 'settings', () => projects.openSettings()),
  );
  return nav;
}

function navButton(
  label: string,
  name: 'list' | 'billing' | 'settings',
  onClick: () => void,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  const route = projects.route();
  button.setAttribute('aria-current', route.name === name ? 'page' : 'false');
  button.addEventListener('click', onClick);
  return button;
}

function content(): HTMLElement {
  const main = document.createElement('main');
  const route = projects.route();
  if (route.name === 'billing') {
    main.append(
      heading('Billing', 'Manage invoices for this workspace.'),
      paragraph('No invoices in this session.'),
    );
    return main;
  }
  if (route.name === 'settings') {
    main.append(
      heading('Settings', 'Session preferences stay in memory.'),
      paragraph('Refresh the page to clear projects and the assistant transcript.'),
    );
    return main;
  }
  if (route.name === 'details') {
    main.append(detailsView(route.id));
    return main;
  }
  main.append(listView());
  return main;
}

function listView(): DocumentFragment {
  const fragment = document.createDocumentFragment();
  fragment.append(heading('Projects', 'Manage your projects, collaborate with your team.'));
  const form = document.createElement('form');
  form.className = 'create';
  const field = document.createElement('input');
  field.name = 'name';
  field.required = true;
  field.setAttribute('aria-label', 'Project name');
  field.placeholder = 'New project';
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.textContent = 'Create';
  form.append(field, submit);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    projects.createProject(field.value);
    field.value = '';
  });
  const list = document.createElement('ul');
  list.className = 'projects';
  for (const project of projects.list()) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.addEventListener('click', () => {
      projects.openProject(project.id);
    });
    const name = document.createElement('span');
    name.textContent = project.name;
    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = `Updated ${formatUpdated(project.updatedAt)}`;
    button.append(name, meta);
    item.append(button);
    list.append(item);
  }
  fragment.append(form, list);
  return fragment;
}

function detailsView(id: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const project = projects.get(id);
  fragment.append(
    heading(
      project.name,
      project.archived ? 'This project is archived.' : `Project id ${project.id}`,
    ),
  );
  const form = document.createElement('form');
  const field = document.createElement('input');
  field.name = 'name';
  field.value = project.name;
  field.setAttribute('aria-label', 'Project name');
  const save = document.createElement('button');
  save.type = 'submit';
  save.textContent = 'Rename';
  form.append(field, save);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    projects.renameProject(id, field.value);
  });
  const actions = document.createElement('div');
  actions.className = 'actions';
  const archive = document.createElement('button');
  archive.type = 'button';
  archive.textContent = 'Archive';
  archive.disabled = project.archived;
  archive.addEventListener('click', () => {
    projects.archiveProject(id);
  });
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'danger';
  remove.textContent = 'Delete';
  remove.addEventListener('click', () => {
    projects.deleteProject(id);
  });
  actions.append(archive, remove);
  fragment.append(form, actions);
  return fragment;
}

function heading(title: string, subtitle: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const h1 = document.createElement('h1');
  h1.textContent = title;
  const p = document.createElement('p');
  p.className = 'lede';
  p.textContent = subtitle;
  fragment.append(h1, p);
  return fragment;
}

function paragraph(text: string): HTMLParagraphElement {
  const node = document.createElement('p');
  node.textContent = text;
  return node;
}

function formatUpdated(updatedAt: number): string {
  const delta = Date.now() - updatedAt;
  const hours = Math.max(1, Math.round(delta / HOUR));
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

const HOUR = 60 * 60 * 1000;

projects.subscribe(render);
render();
