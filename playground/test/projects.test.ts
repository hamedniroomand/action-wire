import { expect, it } from 'vitest';

import { createProjects } from '../src/projects';

it('mutates the same store from UI actions and tool handlers', () => {
  const projects = createProjects();
  const created = projects.createProject('Beacon');
  expect(projects.list()[0]).toEqual(created);
  expect(created.name).toBe('Beacon');

  projects.renameProject(created.id, 'Aurora');
  expect(projects.get(created.id).name).toBe('Aurora');
  expect(projects.list()[0]?.id).toBe(created.id);

  projects.archiveProject(created.id);
  expect(projects.list().some((project) => project.id === created.id)).toBe(false);
  expect(projects.get(created.id).archived).toBe(true);

  projects.deleteProject(created.id);
  expect(() => projects.get(created.id)).toThrow(/id/i);
});

it('lists Phoenix first with deterministic latest-project order', () => {
  const projects = createProjects();
  expect(projects.list().map((project) => project.name)).toEqual([
    'Phoenix',
    'Orion',
    'Nova',
    'Atlas',
  ]);

  projects.renameProject('atlas', 'Atlas Prime');
  expect(projects.list().map((project) => project.name)).toEqual([
    'Atlas Prime',
    'Phoenix',
    'Orion',
    'Nova',
  ]);
});

it('rejects invalid ids and empty names', () => {
  const projects = createProjects();
  expect(() => projects.get('missing')).toThrow(/id/i);
  expect(() => projects.openProject('missing')).toThrow(/id/i);
  expect(() => projects.renameProject('missing', 'Aurora')).toThrow(/id/i);
  expect(() => projects.archiveProject('missing')).toThrow(/id/i);
  expect(() => projects.deleteProject('missing')).toThrow(/id/i);
  expect(() => projects.createProject('')).toThrow(/name/i);
  expect(() => projects.createProject('   ')).toThrow(/name/i);
  expect(() => projects.renameProject('phoenix', '')).toThrow(/name/i);
});
