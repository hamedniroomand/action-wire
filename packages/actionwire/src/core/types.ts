import type { ErrorCode } from '~/core/errors';

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type ToolDefinition = {
  id: string;
  name: string;
  description: string;
  inputSchema: Record<string, Json>;
  readOnly?: boolean;
  consequential?: boolean;
};
export type ToolSnapshot = { revision: number; tools: readonly ToolDefinition[] };
export type ToolCall = { id: string; toolId: string; arguments: Record<string, Json> };
export type ToolResult = {
  callId: string;
  ok: boolean;
  text: string;
  data?: Json;
  code?: ErrorCode;
};
export interface ToolSource {
  discover(signal?: AbortSignal): Promise<ToolSnapshot>;
  execute(call: ToolCall, revision: number, signal?: AbortSignal): Promise<ToolResult>;
  subscribe(listener: () => void): () => void;
  dispose(): void;
}
export type Message =
  | { role: 'user' | 'system'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: ToolCall[] }
  | { role: 'tool'; content: string; callId: string };
export type AgentTurn = { text: string; toolCalls: ToolCall[] };
export interface AgentAdapter {
  generate(input: {
    messages: readonly Message[];
    tools: readonly ToolDefinition[];
    signal?: AbortSignal;
  }): Promise<AgentTurn>;
}
export type ToolStatus =
  | 'queued'
  | 'awaiting-confirmation'
  | 'running'
  | 'success'
  | 'error'
  | 'cancelled';
export type Activity = { call: ToolCall; status: ToolStatus; result?: ToolResult };
export type Confirmation = {
  id: string;
  call: ToolCall;
  revision: number;
  title: string;
  confirmLabel: string;
};
export type TimelineItem =
  | { kind: 'message'; index: number }
  | { kind: 'activity'; callId: string };
export type AssistantState = {
  timeline: readonly TimelineItem[];
  messages: readonly Message[];
  activities: readonly Activity[];
  confirmation?: Confirmation;
  busy: boolean;
  error?: { code: ErrorCode; message: string };
};
export interface Assistant {
  send(text: string): Promise<void>;
  refreshTools(): Promise<ToolSnapshot>;
  confirm(id: string, approved: boolean): void;
  cancel(): void;
  clear(): void;
  getState(): AssistantState;
  subscribe(listener: (state: AssistantState) => void): () => void;
  dispose(): void;
}
export type ConfirmationPolicy = (tool: ToolDefinition, call: ToolCall) => boolean;
export type Theme = 'light' | 'dark' | 'system';
export type BridgeOptions = {
  source: ToolSource;
  model: AgentAdapter;
  requiresConfirmation?: ConfirmationPolicy;
  maxRounds?: number;
  timeoutMs?: number;
};
export type AssistantOptions = {
  model: AgentAdapter;
  source?: ToolSource;
  requiresConfirmation?: ConfirmationPolicy;
  developerMode?: boolean;
  theme?: Theme;
  maxRounds?: number;
  timeoutMs?: number;
};
export interface MountedAssistant extends Assistant {
  mount(target?: HTMLElement): void;
  unmount(): void;
  setTheme(theme: Theme): void;
}
