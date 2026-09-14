export type Chart = {
  id: string;
  version: string;
  name: string;
  unit: string;
  points: readonly number[];
};

export type ReportInput = {
  chartId: string;
  chartVersion: string;
  title: string;
  audience: string;
  week: number;
};

export type Report = ReportInput & { id: string };

export type Reports = {
  charts(): readonly Chart[];
  chart(id: string): Chart;
  selected(): Chart | undefined;
  select(id: string | undefined): void;
  list(): readonly Report[];
  get(id: string): Report;
  describe(input: ReportInput): string;
  create(input: ReportInput): Report;
  open(id: string): Report;
  opened(): Report | undefined;
  subscribe(listener: () => void): () => void;
};

const REPORT_KEYS = ['chartId', 'chartVersion', 'title', 'audience', 'week'] as const;

export function parseReportInput(value: unknown): ReportInput {
  if (!isPlainRecord(value)) {
    throw new Error('The report input is not valid.');
  }
  for (const key of Object.keys(value)) {
    if (!isReportKey(key)) {
      throw new Error('The report input is not valid.');
    }
  }
  const chartId = readString(value, 'chartId');
  const chartVersion = readString(value, 'chartVersion');
  const title = readString(value, 'title').trim();
  const audience = readString(value, 'audience').trim();
  const week = readWeek(value.week);
  if (title === '') throw new Error('The report title is empty.');
  if (audience === '') throw new Error('The report audience is empty.');
  return { chartId, chartVersion, title, audience, week };
}

export function assertChartVersion(chartEntry: Chart, chartVersion: string): void {
  if (chartEntry.version !== chartVersion) throw new Error('The chart version is stale.');
}

export function resolveReportChart(reports: Reports, input: ReportInput): Chart {
  const chartEntry = reports.chart(input.chartId);
  assertChartVersion(chartEntry, input.chartVersion);
  return chartEntry;
}

function copyChart(entry: Chart): Chart {
  return { ...entry, points: [...entry.points] };
}

function copyReport(entry: Report): Report {
  return { ...entry };
}

export function createReports(): Reports {
  const charts = new Map<string, Chart>(
    [
      chart('weekly-revenue', 'v1', 'Weekly revenue', 'USD', [12, 15, 14, 18, 22, 19, 24]),
      chart('active-users', 'v1', 'Active users', 'users', [420, 455, 441, 502]),
    ].map((entry) => [entry.id, entry]),
  );
  const reports = new Map<string, Report>();
  let selectedId: string | undefined = 'weekly-revenue';
  let openedId: string | undefined;
  let nextReport = 1;
  const listeners = new Set<() => void>();

  function notify(): void {
    for (const listener of listeners) listener();
  }

  function requiredChart(id: string): Chart {
    const entry = charts.get(id);
    if (entry === undefined) throw new Error('The chart id is not valid.');
    return entry;
  }

  function requiredReport(id: string): Report {
    const entry = reports.get(id);
    if (entry === undefined) throw new Error('The report id is not valid.');
    return entry;
  }

  return {
    charts() {
      return [...charts.values()].map(copyChart);
    },
    chart(id) {
      return copyChart(requiredChart(id));
    },
    selected() {
      if (selectedId === undefined) return undefined;
      return copyChart(requiredChart(selectedId));
    },
    select(id) {
      if (id === undefined) {
        selectedId = undefined;
        notify();
        return;
      }
      requiredChart(id);
      selectedId = id;
      notify();
    },
    list() {
      return [...reports.values()].map(copyReport);
    },
    get(id) {
      return copyReport(requiredReport(id));
    },
    describe(input) {
      const parsed = parseReportInput(input);
      const chartEntry = requiredChart(parsed.chartId);
      assertChartVersion(chartEntry, parsed.chartVersion);
      return formatDescription(parsed, copyChart(chartEntry));
    },
    create(input) {
      const parsed = parseReportInput(input);
      const live = requiredChart(parsed.chartId);
      assertChartVersion(live, parsed.chartVersion);
      const id = `report-${nextReport}`;
      nextReport += 1;
      const created: Report = { ...parsed, id };
      reports.set(id, created);
      notify();
      return copyReport(created);
    },
    open(id) {
      requiredReport(id);
      openedId = id;
      notify();
      return copyReport(requiredReport(id));
    },
    opened() {
      if (openedId === undefined) return undefined;
      return copyReport(requiredReport(openedId));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function formatDescription(input: ReportInput, chartEntry: Chart): string {
  return [
    `Title: ${input.title}`,
    `Audience: ${input.audience}`,
    `Week: ${input.week}`,
    `Chart: ${chartEntry.name} (${chartEntry.id}, ${chartEntry.version})`,
    `Unit: ${chartEntry.unit}`,
    `Points: ${chartEntry.points.join(', ')}`,
    'This preview does not create a report or send it anywhere.',
  ].join('\n');
}

function chart(
  id: string,
  version: string,
  name: string,
  unit: string,
  points: readonly number[],
): Chart {
  return { id, version, name, unit, points: [...points] };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isReportKey(key: string): key is (typeof REPORT_KEYS)[number] {
  return REPORT_KEYS.some((entry) => entry === key);
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string') throw new Error('The report input is not valid.');
  return value;
}

function readWeek(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error('The report week is not valid.');
  }
  if (value < 1 || value > 53) throw new Error('The report week is not valid.');
  return value;
}
