import type { Projects, Route } from './projects';
import { parseReportInput, resolveReportChart, type ReportInput, type Reports } from './reports';

type NativeTool = {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; consequentialHint: boolean };
  execute: (input: unknown) => Promise<{ text: string }>;
};

type NativeContext = {
  registerTool(tool: NativeTool, options?: { signal: AbortSignal }): Promise<void>;
};

type ToolSpec = {
  name: string;
  description: string;
  readOnly?: boolean;
  consequential?: boolean;
  inputSchema: object;
  run: (
    deps: { projects: Projects; reports: Reports },
    input: Record<string, unknown>,
  ) => Promise<{ text: string }>;
};

const OBJECT = { type: 'object', additionalProperties: false } as const;
const ID = {
  type: 'object',
  additionalProperties: false,
  properties: { id: { type: 'string' } },
  required: ['id'],
} as const;
const NAME = {
  type: 'object',
  additionalProperties: false,
  properties: { name: { type: 'string' } },
  required: ['name'],
} as const;
const RENAME = {
  type: 'object',
  additionalProperties: false,
  properties: { id: { type: 'string' }, name: { type: 'string' } },
  required: ['id', 'name'],
} as const;
const REPORT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    chartId: { type: 'string' },
    chartVersion: { type: 'string' },
    title: { type: 'string' },
    audience: { type: 'string' },
    week: { type: 'integer' },
  },
  required: ['chartId', 'chartVersion', 'title', 'audience', 'week'],
} as const;

const GLOBAL_TOOLS: readonly ToolSpec[] = [
  {
    name: 'listProjects',
    description: 'List active projects, latest first.',
    readOnly: true,
    inputSchema: OBJECT,
    run: async ({ projects }) => ({
      text: projects
        .list()
        .map((project) => `${project.name} (id: ${project.id})`)
        .join('\n'),
    }),
  },
  {
    name: 'openProject',
    description:
      'Open a project by id. Rename, archive, and delete tools are available while a project is open.',
    readOnly: true,
    inputSchema: ID,
    run: async ({ projects }, input) => {
      const project = projects.openProject(readString(input, 'id'));
      await flushTools();
      return { text: `Opened ${project.name}` };
    },
  },
  {
    name: 'createProject',
    description: 'Create a project.',
    inputSchema: NAME,
    run: async ({ projects }, input) => {
      const project = projects.createProject(readString(input, 'name'));
      return { text: `Created ${project.name} (id: ${project.id})` };
    },
  },
  {
    name: 'openBilling',
    description: 'Open the billing view.',
    readOnly: true,
    inputSchema: OBJECT,
    run: async ({ projects }) => {
      projects.openBilling();
      await flushTools();
      return { text: 'Opened billing' };
    },
  },
];

const CONTEXTUAL_TOOLS: readonly ToolSpec[] = [
  {
    name: 'renameProject',
    description: 'Rename a project.',
    inputSchema: RENAME,
    run: async ({ projects }, input) => {
      const project = projects.renameProject(readString(input, 'id'), readString(input, 'name'));
      return { text: `Renamed to ${project.name}` };
    },
  },
  {
    name: 'archiveProject',
    description: 'Archive a project.',
    inputSchema: ID,
    run: async ({ projects }, input) => {
      const project = projects.archiveProject(readString(input, 'id'));
      return { text: `Archived ${project.name}` };
    },
  },
  {
    name: 'deleteProject',
    description: 'Delete a project. This action cannot be undone.',
    consequential: true,
    inputSchema: ID,
    run: async ({ projects }, input) => {
      const id = readString(input, 'id');
      const project = projects.get(id);
      projects.deleteProject(id);
      await flushTools();
      return { text: `Deleted ${project.name}` };
    },
  },
];

const REPORT_TOOLS: readonly ToolSpec[] = [
  {
    name: 'listCharts',
    description: 'List available charts with ids, versions, and labels.',
    readOnly: true,
    inputSchema: OBJECT,
    run: async ({ reports }) => ({
      text: reports
        .charts()
        .map((entry) => `${entry.name} (id: ${entry.id}, version: ${entry.version})`)
        .join('\n'),
    }),
  },
  {
    name: 'previewReport',
    description: 'Validate report settings and return a description. It creates nothing.',
    readOnly: true,
    inputSchema: REPORT,
    run: async ({ reports }, input) => {
      const parsed = parseReportInput(input);
      resolveReportChart(reports, parsed);
      return { text: reports.describe(parsed) };
    },
  },
  {
    name: 'createReport',
    description: 'Create a local report for the product team. It does not send the report.',
    consequential: true,
    inputSchema: REPORT,
    run: async ({ reports }, input) => {
      const parsed = parseReportInput(input);
      resolveReportChart(reports, parsed);
      const created = reports.create(parsed);
      return { text: `Created report ${created.id}: ${created.title} for ${created.audience}` };
    },
  },
  {
    name: 'openReport',
    description: 'Open an existing report and show its detail view.',
    readOnly: true,
    inputSchema: ID,
    run: async ({ reports }, input) => {
      const report = reports.open(readString(input, 'id'));
      return {
        text: `Opened ${report.title} (week ${report.week}, audience ${report.audience})`,
      };
    },
  },
];

let flushTools: () => Promise<void> = async () => {};

export async function registerDashboardTools(
  projects: Projects,
  reports: Reports,
): Promise<() => void> {
  const context = nativeContext();
  const deps = { projects, reports };
  const global = new AbortController();
  await registerTools(context, deps, GLOBAL_TOOLS, global.signal);

  let contextual = new AbortController();
  let routeKey = toolRouteKey(projects.route());

  async function syncContextual(): Promise<void> {
    contextual.abort();
    contextual = new AbortController();
    const signal = contextual.signal;
    const route = projects.route();
    const specs =
      route.name === 'details' ? CONTEXTUAL_TOOLS : route.name === 'reports' ? REPORT_TOOLS : [];
    if (specs.length === 0) return;
    try {
      await registerTools(context, deps, specs, signal);
    } catch (error) {
      if (signal.aborted || isAbort(error)) return;
      throw error;
    }
  }
  flushTools = syncContextual;

  const stop = projects.subscribe(() => {
    const nextKey = toolRouteKey(projects.route());
    if (nextKey === routeKey) return;
    routeKey = nextKey;
    void syncContextual();
  });
  await syncContextual();
  return () => {
    stop();
    flushTools = async () => {};
    global.abort();
    contextual.abort();
  };
}

function toolRouteKey(route: Route): string {
  if (route.name === 'details') return `details:${route.id}`;
  if (route.name === 'reports') return 'reports';
  return route.name;
}

async function registerTools(
  context: NativeContext,
  deps: { projects: Projects; reports: Reports },
  specs: readonly ToolSpec[],
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted) return;
  await Promise.all(
    specs.map((spec) =>
      context.registerTool(
        {
          name: spec.name,
          description: spec.description,
          inputSchema: spec.inputSchema,
          annotations: {
            readOnlyHint: spec.readOnly === true,
            consequentialHint: spec.consequential === true,
          },
          execute: async (input) => spec.run(deps, asRecord(input)),
        },
        { signal },
      ),
    ),
  );
}

function nativeContext(): NativeContext {
  const value = Reflect.get(document, 'modelContext');
  if (!isNativeContext(value)) throw new Error('This browser does not support WebMCP.');
  return value;
}

function isNativeContext(value: unknown): value is NativeContext {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'registerTool') === 'function'
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    const parsed: unknown = JSON.parse(value);
    return asRecord(parsed);
  }
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return Object.fromEntries(Object.entries(value));
  }
  return {};
}

function isAbort(error: unknown): boolean {
  return typeof error === 'object' && error !== null && Reflect.get(error, 'name') === 'AbortError';
}

function readString(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== 'string') throw new Error(`The ${key} input is not valid.`);
  return value;
}

export type { ReportInput };
