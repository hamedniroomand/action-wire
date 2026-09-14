import { createAssistant, openAICompatible, type ToolCall } from 'actionwire';

import { createReportsContext } from './context';
import type { Projects } from './projects';
import type { Reports } from './reports';
import { assertChartVersion } from './reports';

export function mountAssistant(projects: Projects, reports: Reports): () => void {
  const assistant = createAssistant({
    model: openAICompatible({ endpoint: '/api/assistant' }),
    context: createReportsContext(projects, reports),
    review: {
      previewTools: { createReport: 'previewReport' },
      targets: async (call: ToolCall, signal: AbortSignal) => {
        if (signal.aborted || call.toolId !== 'createReport') return [];
        const chartId = call.arguments.chartId;
        const chartVersion = call.arguments.chartVersion;
        if (typeof chartId !== 'string' || typeof chartVersion !== 'string') {
          throw new Error('The report target is not valid.');
        }
        const chart = reports.chart(chartId);
        assertChartVersion(chart, chartVersion);
        return [{ resource: `chart:${chart.id}`, label: chart.name, version: chart.version }];
      },
    },
  });
  assistant.mount();
  return () => {
    assistant.dispose();
  };
}
