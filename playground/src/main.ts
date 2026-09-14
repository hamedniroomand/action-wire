import { mountAssistant } from './assistant';
import { el } from './dom';
import { createProjects } from './projects';
import { createReports, type Reports } from './reports';
import { registerDashboardTools } from './tools';
import { detailsView, listView } from './views/projects';
import { reportsView } from './views/reports';
import { sidebar } from './views/sidebar';
import { billingView, settingsView } from './views/static';

const projects = createProjects();
const reports = createReports();
const app = appRoot();

publishReportCount(reports);
void registerDashboardTools(projects, reports)
  .catch(() => undefined)
  .finally(() => {
    mountAssistant(projects, reports);
  });

function appRoot(): HTMLElement {
  const root = document.querySelector('#app');
  if (!(root instanceof HTMLElement)) throw new Error('The app root is missing.');
  return root;
}

/** The end-to-end tests read this count to confirm a tool created a report. */
function publishReportCount(source: Reports): void {
  const publish = () => {
    Reflect.set(globalThis, '__reportCount', source.list().length);
  };
  publish();
  source.subscribe(publish);
}

function content(): HTMLElement {
  const main = el('main');
  main.append(routeView());
  return main;
}

function routeView(): DocumentFragment {
  const route = projects.route();
  if (route.name === 'billing') return billingView();
  if (route.name === 'settings') return settingsView();
  if (route.name === 'reports') return reportsView(reports);
  if (route.name === 'details') return detailsView(projects, route.id);
  return listView(projects);
}

function render(): void {
  app.replaceChildren(sidebar(projects), content());
}

projects.subscribe(render);
reports.subscribe(render);
render();
