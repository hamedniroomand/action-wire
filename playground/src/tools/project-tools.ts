import { ID, NAME, OBJECT, RENAME } from './schemas';
import { readString, type ToolSpec } from './spec';

export const GLOBAL_TOOLS: readonly ToolSpec[] = [
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
    run: async ({ projects, flush }, input) => {
      const project = projects.openProject(readString(input, 'id'));
      await flush();
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
    run: async ({ projects, flush }) => {
      projects.openBilling();
      await flush();
      return { text: 'Opened billing' };
    },
  },
];

export const CONTEXTUAL_TOOLS: readonly ToolSpec[] = [
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
    run: async ({ projects, flush }, input) => {
      const id = readString(input, 'id');
      const project = projects.get(id);
      projects.deleteProject(id);
      await flush();
      return { text: `Deleted ${project.name}` };
    },
  },
];
