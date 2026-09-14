import type { Projects } from '../projects';
import type { Reports } from '../reports';

export type ToolDeps = {
  projects: Projects;
  reports: Reports;
  /** Re-registers the route tools so the next discovery sees the new list. */
  flush: () => Promise<void>;
};

export type ToolSpec = {
  name: string;
  description: string;
  readOnly?: boolean;
  consequential?: boolean;
  inputSchema: object;
  run: (deps: ToolDeps, input: Record<string, unknown>) => Promise<{ text: string }>;
};

export function readString(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== 'string') throw new Error(`The ${key} input is not valid.`);
  return value;
}
