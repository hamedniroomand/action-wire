export type Project = {
  id: string;
  name: string;
  archived: boolean;
  updatedAt: number;
};

export type Route =
  | { name: 'list' }
  | { name: 'details'; id: string }
  | { name: 'billing' }
  | { name: 'settings' }
  | { name: 'reports'; projectId?: string };

export type Projects = {
  list(): Project[];
  get(id: string): Project;
  createProject(name: string): Project;
  openProject(id: string): Project;
  renameProject(id: string, name: string): Project;
  archiveProject(id: string): Project;
  deleteProject(id: string): void;
  openBilling(): void;
  openSettings(): void;
  openList(): void;
  openReports(projectId?: string): void;
  route(): Route;
  subscribe(listener: () => void): () => void;
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export function createProjects(now: () => number = Date.now): Projects {
  const origin = now();
  const records = new Map<string, Project>(
    [
      project('phoenix', 'Phoenix', origin - 2 * HOUR),
      project('orion', 'Orion', origin - DAY),
      project('nova', 'Nova', origin - 3 * DAY),
      project('atlas', 'Atlas', origin - 7 * DAY),
    ].map((entry) => [entry.id, entry]),
  );
  let current: Route = { name: 'list' };
  const listeners = new Set<() => void>();

  function notify(): void {
    for (const listener of listeners) listener();
  }

  function required(id: string): Project {
    const record = records.get(id);
    if (record === undefined) throw new Error('The project id is not valid.');
    return record;
  }

  function named(id: string, name: string): Project {
    const trimmed = name.trim();
    if (trimmed === '') throw new Error('The project name is empty.');
    const record = required(id);
    const next = { ...record, name: trimmed, updatedAt: now() };
    records.set(id, next);
    return next;
  }

  return {
    list() {
      return [...records.values()]
        .filter((entry) => !entry.archived)
        .toSorted(
          (left, right) => right.updatedAt - left.updatedAt || left.name.localeCompare(right.name),
        );
    },
    get(id) {
      return required(id);
    },
    createProject(name) {
      const trimmed = name.trim();
      if (trimmed === '') throw new Error('The project name is empty.');
      const record = project(nextId(records, trimmed), trimmed, now());
      records.set(record.id, record);
      notify();
      return record;
    },
    openProject(id) {
      const record = required(id);
      current = { name: 'details', id };
      notify();
      return record;
    },
    renameProject(id, name) {
      const record = named(id, name);
      notify();
      return record;
    },
    archiveProject(id) {
      const record = required(id);
      const next = { ...record, archived: true, updatedAt: now() };
      records.set(id, next);
      notify();
      return next;
    },
    deleteProject(id) {
      required(id);
      records.delete(id);
      if (current.name === 'details' && current.id === id) current = { name: 'list' };
      notify();
    },
    openBilling() {
      current = { name: 'billing' };
      notify();
    },
    openSettings() {
      current = { name: 'settings' };
      notify();
    },
    openList() {
      current = { name: 'list' };
      notify();
    },
    openReports(projectId) {
      if (projectId !== undefined) required(projectId);
      current = projectId === undefined ? { name: 'reports' } : { name: 'reports', projectId };
      notify();
    },
    route() {
      return current;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function project(id: string, name: string, updatedAt: number): Project {
  return { id, name, archived: false, updatedAt };
}

function nextId(records: Map<string, Project>, name: string): string {
  const base = slug(name);
  if (!records.has(base)) return base;
  let suffix = 2;
  while (records.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function slug(name: string): string {
  const value = name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '');
  return value === '' ? 'project' : value;
}
