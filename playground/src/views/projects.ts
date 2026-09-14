import { button, el, field, heading, listItem, submitButton } from '../dom';
import type { Projects } from '../projects';

const HOUR = 60 * 60 * 1000;

export function listView(projects: Projects): DocumentFragment {
  const fragment = document.createDocumentFragment();
  fragment.append(heading('Projects', 'Manage your projects, collaborate with your team.'));

  const form = el('form', 'create');
  const name = field('name', 'Project name', 'New project');
  form.append(name, submitButton('Create'));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    projects.createProject(name.value);
    name.value = '';
  });

  const list = el('ul', 'projects');
  for (const project of projects.list()) {
    list.append(
      listItem(
        project.name,
        () => {
          projects.openProject(project.id);
        },
        `Updated ${formatUpdated(project.updatedAt)}`,
      ),
    );
  }
  fragment.append(form, list);
  return fragment;
}

export function detailsView(projects: Projects, id: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const project = projects.get(id);
  fragment.append(
    heading(
      project.name,
      project.archived ? 'This project is archived.' : `Project id ${project.id}`,
    ),
  );

  const form = el('form');
  const name = field('name', 'Project name');
  name.value = project.name;
  form.append(name, submitButton('Rename'));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    projects.renameProject(id, name.value);
  });

  const archive = button('Archive', () => {
    projects.archiveProject(id);
  });
  archive.disabled = project.archived;

  const actions = el('div', 'actions');
  actions.append(
    button('Reports for this project', () => {
      projects.openReports(id);
    }),
    archive,
    button(
      'Delete',
      () => {
        projects.deleteProject(id);
      },
      'danger',
    ),
  );
  fragment.append(form, actions);
  return fragment;
}

function formatUpdated(updatedAt: number): string {
  const hours = Math.max(1, Math.round((Date.now() - updatedAt) / HOUR));
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
