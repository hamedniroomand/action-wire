import type { Projects, Route } from '../projects';
import type { Reports } from '../reports';
import { nativeContext, registerTools } from './native';
import { CONTEXTUAL_TOOLS, GLOBAL_TOOLS } from './project-tools';
import { REPORT_TOOLS } from './report-tools';
import type { ToolDeps, ToolSpec } from './spec';

export async function registerDashboardTools(
  projects: Projects,
  reports: Reports,
): Promise<() => void> {
  const context = nativeContext();
  const deps: ToolDeps = { projects, reports, flush: () => syncContextual() };
  const global = new AbortController();
  await registerTools(context, deps, GLOBAL_TOOLS, global.signal);

  let contextual = new AbortController();
  let routeKey = toolRouteKey(projects.route());

  async function syncContextual(): Promise<void> {
    contextual.abort();
    contextual = new AbortController();
    const signal = contextual.signal;
    const specs = routeTools(projects.route());
    if (specs.length === 0) return;
    try {
      await registerTools(context, deps, specs, signal);
    } catch (error) {
      if (signal.aborted || isAbort(error)) return;
      throw error;
    }
  }

  const stop = projects.subscribe(() => {
    const nextKey = toolRouteKey(projects.route());
    if (nextKey === routeKey) return;
    routeKey = nextKey;
    void syncContextual();
  });
  await syncContextual();
  return () => {
    stop();
    global.abort();
    contextual.abort();
  };
}

function routeTools(route: Route): readonly ToolSpec[] {
  if (route.name === 'details') return CONTEXTUAL_TOOLS;
  if (route.name === 'reports') return REPORT_TOOLS;
  return [];
}

function toolRouteKey(route: Route): string {
  if (route.name === 'details') return `details:${route.id}`;
  if (route.name === 'reports') return 'reports';
  return route.name;
}

function isAbort(error: unknown): boolean {
  return typeof error === 'object' && error !== null && Reflect.get(error, 'name') === 'AbortError';
}
