import { button, el, text } from '../dom';
import type { Projects, Route } from '../projects';

type NavName = 'list' | 'reports' | 'billing' | 'settings';

const LINKS: readonly { label: string; name: NavName; open: (projects: Projects) => void }[] = [
  { label: 'Projects', name: 'list', open: (projects) => projects.openList() },
  { label: 'Reports', name: 'reports', open: (projects) => projects.openReports() },
  { label: 'Billing', name: 'billing', open: (projects) => projects.openBilling() },
  { label: 'Settings', name: 'settings', open: (projects) => projects.openSettings() },
];

export function sidebar(projects: Projects): HTMLElement {
  const nav = el('nav', 'sidebar');
  nav.setAttribute('aria-label', 'Application');
  nav.append(text('p', 'brand', 'Acme Project'));
  const route = projects.route();
  for (const link of LINKS) {
    const node = button(link.label, () => link.open(projects));
    node.setAttribute('aria-current', isActive(route, link.name) ? 'page' : 'false');
    nav.append(node);
  }
  return nav;
}

function isActive(route: Route, name: NavName): boolean {
  if (route.name === name) return true;
  return name === 'list' && route.name === 'details';
}
