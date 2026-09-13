// @vitest-environment happy-dom

import { afterEach, expect, it } from 'vitest';

import { createProjects } from '../src/projects';
import { registerDashboardTools } from '../src/tools';

type NativeTool = {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; consequentialHint: boolean };
  execute: (input: Record<string, unknown>) => Promise<{ text: string }>;
};

function installNative(): Map<string, NativeTool> {
  const tools = new Map<string, NativeTool>();
  const context = {
    async registerTool(tool: NativeTool, options?: { signal: AbortSignal }) {
      tools.set(tool.name, tool);
      options?.signal.addEventListener('abort', () => {
        tools.delete(tool.name);
      });
    },
    async getTools() {
      return [...tools.values()];
    },
    async executeTool(tool: NativeTool, input: Record<string, unknown>) {
      return JSON.stringify(await tool.execute(input));
    },
  };
  Object.defineProperty(document, 'modelContext', { value: context, configurable: true });
  return tools;
}

afterEach(() => {
  Reflect.deleteProperty(document, 'modelContext');
});

it('runs tool execution through the same project store as the UI', async () => {
  const registered = installNative();
  const projects = createProjects();
  await registerDashboardTools(projects);
  const list = registered.get('listProjects');
  if (list === undefined) throw new Error('listProjects is missing.');
  const listed = await list.execute({});
  expect(listed.text).toContain('Phoenix');

  projects.openProject('phoenix');
  const rename = registered.get('renameProject');
  if (rename === undefined) throw new Error('renameProject is missing.');
  await rename.execute({ id: 'phoenix', name: 'Aurora' });
  expect(projects.get('phoenix').name).toBe('Aurora');
  expect(projects.list()[0]?.name).toBe('Aurora');
});

it('marks delete as consequential and list as read-only', async () => {
  const registered = installNative();
  const projects = createProjects();
  await registerDashboardTools(projects);
  projects.openProject('phoenix');
  const list = registered.get('listProjects');
  const remove = registered.get('deleteProject');
  if (list === undefined || remove === undefined) throw new Error('expected tools are missing.');
  expect(list.annotations).toEqual({ readOnlyHint: true, consequentialHint: false });
  expect(remove.annotations).toEqual({ readOnlyHint: false, consequentialHint: true });
});

it('changes discovered tools when the route changes', async () => {
  const registered = installNative();
  const projects = createProjects();
  await registerDashboardTools(projects);
  expect([...registered.keys()]).toEqual(
    expect.arrayContaining(['listProjects', 'openProject', 'createProject', 'openBilling']),
  );
  expect(registered.has('deleteProject')).toBe(false);

  projects.openProject('phoenix');
  expect(registered.has('renameProject')).toBe(true);
  expect(registered.has('archiveProject')).toBe(true);
  expect(registered.has('deleteProject')).toBe(true);

  projects.openBilling();
  expect(registered.has('deleteProject')).toBe(false);
  expect(registered.has('renameProject')).toBe(false);
  expect(registered.has('openBilling')).toBe(true);
  expect(projects.route()).toEqual({ name: 'billing' });
});
