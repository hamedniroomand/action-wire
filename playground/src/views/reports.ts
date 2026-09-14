import { button, el, field, heading, listItem, readError, submitButton, text } from '../dom';
import { parseReportInput, type ReportInput, type Reports } from '../reports';

export function reportsView(reports: Reports): DocumentFragment {
  const fragment = document.createDocumentFragment();
  fragment.append(
    heading(
      'Reports',
      'Create a local report from a chart. Every user in this demo can create reports.',
    ),
  );

  const preview = text('p', 'lede', '');
  preview.dataset['role'] = 'preview';

  fragment.append(
    text('h2', '', 'Charts'),
    chartList(reports),
    reportForm(reports, preview),
    preview,
    text('h2', '', 'Reports'),
    reportList(reports),
  );

  const opened = reports.opened();
  if (opened !== undefined) {
    fragment.append(
      text('h2', '', 'Opened report'),
      text(
        'p',
        '',
        `${opened.title} · week ${opened.week} · ${opened.audience} · chart ${opened.chartId} (${opened.chartVersion})`,
      ),
    );
  }
  return fragment;
}

function chartList(reports: Reports): HTMLUListElement {
  const list = el('ul', 'projects');
  const selected = reports.selected();
  for (const chart of reports.charts()) {
    const item = el('li');
    const action = button('', () => {
      reports.select(chart.id);
    });
    action.setAttribute('aria-pressed', selected?.id === chart.id ? 'true' : 'false');
    action.append(
      text('span', '', chart.name),
      text('span', 'meta', `${chart.version} · ${chart.unit}`),
    );
    item.append(action);
    list.append(item);
  }
  return list;
}

function reportList(reports: Reports): HTMLUListElement {
  const list = el('ul', 'projects');
  for (const report of reports.list()) {
    list.append(
      listItem(report.title, () => {
        reports.open(report.id);
      }),
    );
  }
  return list;
}

function reportForm(reports: Reports, preview: HTMLParagraphElement): HTMLFormElement {
  const form = el('form', 'create');
  const defaultChartId = reports.selected()?.id ?? 'weekly-revenue';

  const title = field('title', 'Report title', 'Report title');
  const audience = field('audience', 'Audience', 'Audience');
  const week = field('week', 'Week number');
  week.type = 'number';
  week.min = '1';
  week.max = '53';
  week.value = '12';

  function inputPayload(): ReportInput {
    const chartId = reports.selected()?.id ?? defaultChartId;
    return {
      chartId,
      chartVersion: reports.chart(chartId).version,
      title: title.value,
      audience: audience.value,
      week: Number(week.value),
    };
  }

  function run(action: (input: ReportInput) => string): void {
    try {
      preview.textContent = action(parseReportInput(inputPayload()));
    } catch (error) {
      preview.textContent = readError(error);
    }
  }

  form.append(
    title,
    audience,
    week,
    button('Preview', () => {
      run((input) => reports.describe(input));
    }),
    submitButton('Create report'),
  );
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    run((input) => `Created ${reports.create(input).id}.`);
  });
  return form;
}
