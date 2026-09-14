import { mountAssistant } from './assistant';
import { createProjects } from './projects';
import { createReports, parseReportInput, type ReportInput, type Reports } from './reports';
import { registerDashboardTools } from './tools';

const projects = createProjects();
const reports = createReports();
Reflect.set(globalThis, '__reportCount', 0);
reports.subscribe(() => {
  Reflect.set(globalThis, '__reportCount', reports.list().length);
});
Reflect.set(globalThis, '__reportCount', reports.list().length);
const root = document.querySelector('#app');
if (!(root instanceof HTMLElement)) throw new Error('The app root is missing.');
const app = root;

void registerDashboardTools(projects, reports)
  .catch(() => undefined)
  .finally(() => {
    mountAssistant(projects, reports);
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
    navButton('Reports', 'reports', () => projects.openReports()),
    navButton('Billing', 'billing', () => projects.openBilling()),
    navButton('Settings', 'settings', () => projects.openSettings()),
  );
  return nav;
}

function navButton(
  label: string,
  name: 'list' | 'reports' | 'billing' | 'settings',
  onClick: () => void,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  const route = projects.route();
  const active = route.name === name || (name === 'list' && route.name === 'details');
  button.setAttribute('aria-current', active ? 'page' : 'false');
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
  if (route.name === 'reports') {
    main.append(reportsView());
    return main;
  }
  if (route.name === 'details') {
    main.append(detailsView(route.id));
    return main;
  }
  main.append(listView());
  return main;
}

function reportsView(): DocumentFragment {
  const fragment = document.createDocumentFragment();
  fragment.append(
    heading(
      'Reports',
      'Create a local report from a chart. Every user in this demo can create reports.',
    ),
  );

  const chartsHeading = document.createElement('h2');
  chartsHeading.textContent = 'Charts';
  const charts = document.createElement('ul');
  charts.className = 'projects';
  const selected = reports.selected();
  for (const chart of reports.charts()) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-pressed', selected?.id === chart.id ? 'true' : 'false');
    const name = document.createElement('span');
    name.textContent = chart.name;
    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = `${chart.version} · ${chart.unit}`;
    button.append(name, meta);
    button.addEventListener('click', () => {
      reports.select(chart.id);
    });
    item.append(button);
    charts.append(item);
  }
  fragment.append(chartsHeading, charts);

  const preview = document.createElement('p');
  preview.className = 'lede';
  preview.dataset['role'] = 'preview';
  fragment.append(reportForm(preview), preview);

  const listHeading = document.createElement('h2');
  listHeading.textContent = 'Reports';
  const list = document.createElement('ul');
  list.className = 'projects';
  for (const report of reports.list()) {
    list.append(reportListItem(report.id, report.title));
  }
  fragment.append(listHeading, list);

  const opened = reports.opened();
  if (opened !== undefined) {
    fragment.append(openedReportView(opened));
  }
  return fragment;
}

function reportForm(preview: HTMLParagraphElement): HTMLFormElement {
  const form = document.createElement('form');
  form.className = 'create';
  const selected = reports.selected();
  const defaultChartId = selected?.id ?? 'weekly-revenue';

  const title = document.createElement('input');
  title.name = 'title';
  title.required = true;
  title.placeholder = 'Report title';
  title.setAttribute('aria-label', 'Report title');

  const audience = document.createElement('input');
  audience.name = 'audience';
  audience.required = true;
  audience.placeholder = 'Audience';
  audience.setAttribute('aria-label', 'Audience');

  const week = document.createElement('input');
  week.name = 'week';
  week.type = 'number';
  week.min = '1';
  week.max = '53';
  week.required = true;
  week.value = '12';
  week.setAttribute('aria-label', 'Week number');

  const previewButton = document.createElement('button');
  previewButton.type = 'button';
  previewButton.textContent = 'Preview';

  const createButton = document.createElement('button');
  createButton.type = 'submit';
  createButton.textContent = 'Create report';

  form.append(title, audience, week, previewButton, createButton);

  function inputPayload(): ReportInput {
    const chartId = reports.selected()?.id ?? defaultChartId;
    return {
      chartId,
      chartVersion: reports.chart(chartId).version,
      title: title.value,
      audience: audience.value,
      week: Number(week.value),
    };
  }

  function showPreview(text: string): void {
    preview.textContent = text;
  }

  previewButton.addEventListener('click', () => {
    try {
      const parsed = parseReportInput(inputPayload());
      showPreview(reports.describe(parsed));
    } catch (error) {
      showPreview(readError(error));
    }
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const parsed = parseReportInput(inputPayload());
      const created = reports.create(parsed);
      showPreview(`Created ${created.id}.`);
    } catch (error) {
      showPreview(readError(error));
    }
  });

  return form;
}

function reportListItem(id: string, label: string): HTMLLIElement {
  const item = document.createElement('li');
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', () => {
    reports.open(id);
  });
  item.append(button);
  return item;
}

function openedReportView(report: ReturnType<Reports['get']>): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const headingNode = document.createElement('h2');
  headingNode.textContent = 'Opened report';
  const body = document.createElement('p');
  body.textContent = `${report.title} · week ${report.week} · ${report.audience} · chart ${report.chartId} (${report.chartVersion})`;
  fragment.append(headingNode, body);
  return fragment;
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
  const reportsLink = document.createElement('button');
  reportsLink.type = 'button';
  reportsLink.textContent = 'Reports for this project';
  reportsLink.addEventListener('click', () => {
    projects.openReports(id);
  });
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
  actions.append(reportsLink, archive, remove);
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

function readError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'The action failed.';
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
reports.subscribe(render);
render();
