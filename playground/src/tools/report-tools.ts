import { parseReportInput, resolveReportChart } from '../reports';
import { ID, OBJECT, REPORT } from './schemas';
import { readString, type ToolSpec } from './spec';

export const REPORT_TOOLS: readonly ToolSpec[] = [
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
      return { text: `Opened ${report.title} (week ${report.week}, audience ${report.audience})` };
    },
  },
];
