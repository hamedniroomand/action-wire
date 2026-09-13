import type { Projects } from './projects';

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
  run: (projects: Projects, input: Record<string, unknown>) => { text: string };
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

const GLOBAL_TOOLS: readonly ToolSpec[] = [
  {
    name: 'listProjects',
    description: 'List active projects, latest first.',
    readOnly: true,
    inputSchema: OBJECT,
    run: (projects) => ({
      text: projects
        .list()
        .map((project) => project.name)
        .join(', '),
    }),
  },
  {
    name: 'openProject',
    description: 'Open a project by id.',
    readOnly: true,
    inputSchema: ID,
    run: (projects, input) => {
      const project = projects.openProject(readString(input, 'id'));
      return { text: `Opened ${project.name}` };
    },
  },
  {
    name: 'createProject',
    description: 'Create a project.',
    inputSchema: NAME,
    run: (projects, input) => {
      const project = projects.createProject(readString(input, 'name'));
      return { text: `Created ${project.name}` };
    },
  },
  {
    name: 'openBilling',
    description: 'Open the billing view.',
    readOnly: true,
    inputSchema: OBJECT,
    run: (projects) => {
      projects.openBilling();
      return { text: 'Opened billing' };
    },
  },
];

const CONTEXTUAL_TOOLS: readonly ToolSpec[] = [
  {
    name: 'renameProject',
    description: 'Rename a project.',
    inputSchema: RENAME,
    run: (projects, input) => {
      const project = projects.renameProject(readString(input, 'id'), readString(input, 'name'));
      return { text: `Renamed to ${project.name}` };
    },
  },
  {
    name: 'archiveProject',
    description: 'Archive a project.',
    inputSchema: ID,
    run: (projects, input) => {
      const project = projects.archiveProject(readString(input, 'id'));
      return { text: `Archived ${project.name}` };
    },
  },
  {
    name: 'deleteProject',
    description: 'Delete a project. This action cannot be undone.',
    consequential: true,
    inputSchema: ID,
    run: (projects, input) => {
      const id = readString(input, 'id');
      const project = projects.get(id);
      projects.deleteProject(id);
      return { text: `Deleted ${project.name}` };
    },
  },
];

export async function registerDashboardTools(projects: Projects): Promise<() => void> {
  const context = nativeContext();
  const global = new AbortController();
  await registerTools(context, projects, GLOBAL_TOOLS, global.signal);

  let contextual = new AbortController();
  async function syncContextual(): Promise<void> {
    contextual.abort();
    contextual = new AbortController();
    if (projects.route().name !== 'details') return;
    await registerTools(context, projects, CONTEXTUAL_TOOLS, contextual.signal);
  }

  const stop = projects.subscribe(() => {
    void syncContextual();
  });
  await syncContextual();
  return () => {
    stop();
    global.abort();
    contextual.abort();
  };
}

async function registerTools(
  context: NativeContext,
  projects: Projects,
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
          execute: async (input) => spec.run(projects, asRecord(input)),
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

function readString(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== 'string') throw new Error(`The ${key} input is not valid.`);
  return value;
}
