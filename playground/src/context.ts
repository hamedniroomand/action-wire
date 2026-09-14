import type { ContextSource } from 'actionwire';

import type { Projects, Route } from './projects';
import type { Reports } from './reports';

export function createReportsContext(projects: Projects, reports: Reports): ContextSource {
  return {
    read() {
      const route = projects.route();
      if (route.name !== 'reports') return { items: [] };
      const items = [pageItem(route)];
      const selected = reports.selected();
      if (selected !== undefined) {
        items.push({
          id: 'chart-selection',
          label: `Selected: ${selected.name}`,
          resource: `chart:${selected.id}`,
          version: selected.version,
          kind: 'chart',
        });
      }
      return { items };
    },
    subscribe(listener) {
      const stopProjects = projects.subscribe(listener);
      const stopReports = reports.subscribe(listener);
      return () => {
        stopProjects();
        stopReports();
      };
    },
  };
}

function pageItem(route: Extract<Route, { name: 'reports' }>) {
  const resource =
    route.projectId === undefined ? 'page:reports' : `page:reports;project=${route.projectId}`;
  return {
    id: 'page-reports',
    label: 'Current page: Reports',
    resource,
    version: '1',
    kind: 'page',
  };
}
