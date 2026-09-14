import { expect, it } from 'vitest';

import {
  assertChartVersion,
  createReports,
  parseReportInput,
  type ReportInput,
} from '../src/reports';

const validInput = (): ReportInput => ({
  chartId: 'weekly-revenue',
  chartVersion: 'v1',
  title: 'Weekly summary',
  audience: 'Product team',
  week: 12,
});

it('returns immutable chart and report copies', () => {
  const store = createReports();
  const chart = store.chart('weekly-revenue');
  const mutated = [...chart.points, 999];
  expect(mutated.length).toBeGreaterThan(chart.points.length);
  expect(store.chart('weekly-revenue').points).toEqual(chart.points);

  const created = store.create(validInput());
  created.title = 'Changed';
  expect(store.get(created.id).title).toBe('Weekly summary');
});

it('creates reports with stable ids and resolves them with get', () => {
  const store = createReports();
  const first = store.create(validInput());
  const second = store.create({ ...validInput(), title: 'Second' });
  expect(first.id).toBe('report-1');
  expect(second.id).toBe('report-2');
  expect(store.get(first.id).title).toBe('Weekly summary');
});

it('describes and previews without mutating the report list', () => {
  const store = createReports();
  const input = validInput();
  const text = store.describe(input);
  expect(text).toContain('Weekly summary');
  expect(text).toContain('Product team');
  expect(text).toContain('weekly-revenue');
  expect(text).toContain('v1');
  expect(store.list()).toHaveLength(0);
});

it('opens a report and exposes it through opened()', () => {
  const store = createReports();
  const created = store.create(validInput());
  expect(store.opened()).toBeUndefined();
  const opened = store.open(created.id);
  expect(opened.id).toBe(created.id);
  expect(store.opened()?.title).toBe('Weekly summary');
});

it('does not change chart version when selection changes', () => {
  const store = createReports();
  const before = store.chart('weekly-revenue').version;
  store.select('active-users');
  store.select('weekly-revenue');
  expect(store.chart('weekly-revenue').version).toBe(before);
});

it('rejects stale chart versions and invalid input on create', () => {
  const store = createReports();
  expect(() => store.create({ ...validInput(), chartVersion: 'stale' })).toThrow(/version/i);
  expect(store.list()).toHaveLength(0);

  expect(() => store.create({ ...validInput(), chartId: 'missing' })).toThrow(/chart/i);
  expect(() => store.create({ ...validInput(), title: '   ' })).toThrow(/title/i);
  expect(() => store.create({ ...validInput(), audience: '' })).toThrow(/audience/i);
  expect(() => store.create({ ...validInput(), week: 0 })).toThrow(/week/i);
});

it('parses report input and rejects extra keys and wrong types', () => {
  expect(parseReportInput(validInput())).toEqual(validInput());
  expect(() => parseReportInput({ ...validInput(), extra: true })).toThrow(/not valid/i);
  expect(() => parseReportInput({ ...validInput(), week: '12' })).toThrow(/week/i);
  expect(() => parseReportInput({ ...validInput(), week: 1.5 })).toThrow(/week/i);
});

it('assertChartVersion rejects stale versions', () => {
  const store = createReports();
  const chart = store.chart('weekly-revenue');
  expect(() => assertChartVersion(chart, 'stale')).toThrow(/stale/i);
});
