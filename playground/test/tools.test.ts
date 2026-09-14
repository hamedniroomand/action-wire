// @vitest-environment happy-dom

import { afterEach, expect, it } from 'vitest';

import { createProjects } from '../src/projects';
import { createReports } from '../src/reports';
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
  const reports = createReports();
  await registerDashboardTools(projects, reports);
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
  const reports = createReports();
  await registerDashboardTools(projects, reports);
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
  const reports = createReports();
  await registerDashboardTools(projects, reports);
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

it('returns project IDs that later tools can use after names change', async () => {
  const registered = installNative();
  const projects = createProjects();
  const reports = createReports();
  projects.renameProject('phoenix', 'Aurora');
  const stop = await registerDashboardTools(projects, reports);
  try {
    const list = registered.get('listProjects');
    const open = registered.get('openProject');
    if (list === undefined || open === undefined) throw new Error('Missing tools');
    const result = await list.execute({});
    expect(result.text.split('\n')[0]).toBe('Aurora (id: phoenix)');
    const id = result.text.match(/\(id: ([^)]+)\)/)?.[1];
    expect(id).toBeDefined();
    await open.execute({ id });
    expect(projects.route()).toEqual({ name: 'details', id: 'phoenix' });
  } finally {
    stop();
  }
});

const validReport = {
  chartId: 'weekly-revenue',
  chartVersion: 'v1',
  title: 'Weekly summary',
  audience: 'Product team',
  week: 12,
};

it('registers report tools only on the reports route', async () => {
  const registered = installNative();
  const projects = createProjects();
  const reports = createReports();
  await registerDashboardTools(projects, reports);
  expect(registered.has('listCharts')).toBe(false);

  projects.openReports();
  expect(registered.has('listCharts')).toBe(true);
  expect(registered.has('previewReport')).toBe(true);
  expect(registered.has('createReport')).toBe(true);
  expect(registered.has('openReport')).toBe(true);
  expect(registered.has('deleteProject')).toBe(false);
  expect(registered.has('listProjects')).toBe(true);
});

it('keeps report tools registered when chart selection changes', async () => {
  const registered = installNative();
  const projects = createProjects();
  const reports = createReports();
  await registerDashboardTools(projects, reports);
  projects.openReports();
  const before = [...registered.keys()].toSorted();
  reports.select('active-users');
  reports.create(validReport);
  expect([...registered.keys()].toSorted()).toEqual(before);
});

it('preview does not create reports and create returns a stable id', async () => {
  const registered = installNative();
  const projects = createProjects();
  const reports = createReports();
  await registerDashboardTools(projects, reports);
  projects.openReports();
  const preview = registered.get('previewReport');
  const create = registered.get('createReport');
  if (preview === undefined || create === undefined) throw new Error('Missing report tools');

  await preview.execute(validReport);
  expect(reports.list()).toHaveLength(0);

  const result = await create.execute(validReport);
  expect(result.text).toContain('report-1');
  expect(reports.get('report-1').title).toBe('Weekly summary');
});

it('rejects invalid report input in native handlers without mutation', async () => {
  const registered = installNative();
  const projects = createProjects();
  const reports = createReports();
  await registerDashboardTools(projects, reports);
  projects.openReports();
  const preview = registered.get('previewReport');
  const create = registered.get('createReport');
  if (preview === undefined || create === undefined) throw new Error('Missing report tools');

  await expect(preview.execute({ ...validReport, chartId: 'missing' })).rejects.toThrow(/chart/i);
  await expect(preview.execute({ ...validReport, chartVersion: 'stale' })).rejects.toThrow(
    /version|stale/i,
  );
  await expect(preview.execute({ ...validReport, title: '   ' })).rejects.toThrow(/title/i);
  await expect(preview.execute({ ...validReport, week: 0 })).rejects.toThrow(/week/i);
  await expect(preview.execute({ ...validReport, extra: true })).rejects.toThrow(/not valid/i);

  await expect(create.execute({ ...validReport, chartVersion: 'stale' })).rejects.toThrow(
    /version|stale/i,
  );
  expect(reports.list()).toHaveLength(0);
});

it('marks report preview and open as read-only and create as consequential', async () => {
  const registered = installNative();
  const projects = createProjects();
  const reports = createReports();
  await registerDashboardTools(projects, reports);
  projects.openReports();
  const preview = registered.get('previewReport');
  const create = registered.get('createReport');
  const open = registered.get('openReport');
  if (preview === undefined || create === undefined || open === undefined) {
    throw new Error('Missing report tools');
  }
  expect(preview.annotations).toEqual({ readOnlyHint: true, consequentialHint: false });
  expect(open.annotations).toEqual({ readOnlyHint: true, consequentialHint: false });
  expect(create.annotations).toEqual({ readOnlyHint: false, consequentialHint: true });
});
