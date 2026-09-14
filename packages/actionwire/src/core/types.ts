import type { ErrorCode } from '~/core/errors';

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type ToolDefinition = {
  id: string;
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, Json>;
  readOnly?: boolean;
  consequential?: boolean;
  untrustedContent?: boolean;
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

export type ContextItem = {
  id: string;
  label: string;
  resource: string;
  version: string;
  kind?: string;
};
export type ContextSnapshot = { items: readonly ContextItem[] };
export interface ContextSource {
  read(): ContextSnapshot;
  subscribe(listener: () => void): () => void;
}

export type ActionTarget = { resource: string; label: string; version: string };
export type ReviewOptions = {
  previewTools?: Readonly<Record<string, string>>;
  targets?: (call: ToolCall, signal: AbortSignal) => Promise<readonly ActionTarget[]>;
  independent?: (calls: readonly ToolCall[]) => boolean;
};

export type Message =
  | { role: 'user' | 'system'; content: string; context?: readonly ContextItem[] }
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
  | 'preparing'
  | 'needs-input'
  | 'ready-for-review'
  | 'approved'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'denied'
  | 'invalidated'
  | 'cancelled'
  | 'outcome-unknown';

export type ProposalPreview =
  | { kind: 'application'; text: string; data?: Json }
  | { kind: 'unavailable'; reason: string }
  | { kind: 'failed'; reason: string };

export type Proposal = {
  id: string;
  call: ToolCall;
  version: number;
  toolRevision: number;
  context: readonly ContextItem[];
  targets: readonly ActionTarget[];
  title: string;
  status: ToolStatus;
  preview?: ProposalPreview;
  reason?: string;
};

export type Activity = {
  call: ToolCall;
  status: ToolStatus;
  result?: ToolResult;
  dispatched?: boolean;
};
export type TimelineItem =
  | { kind: 'message'; index: number }
  | { kind: 'activity'; callId: string };
export type AssistantState = {
  timeline: readonly TimelineItem[];
  messages: readonly Message[];
  activities: readonly Activity[];
  context: readonly ContextItem[];
  proposals: readonly Proposal[];
  busy: boolean;
  error?: { code: ErrorCode; message: string };
};
export interface Assistant {
  send(text: string): Promise<void>;
  refreshTools(): Promise<ToolSnapshot>;
  confirm(id: string, version: number, approved: boolean): void;
  edit(id: string, version: number, args: Record<string, Json>): void;
  removeContext(id: string): void;
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
  context?: ContextSource;
  review?: ReviewOptions;
  requiresConfirmation?: ConfirmationPolicy;
  maxRounds?: number;
  timeoutMs?: number;
  reviewTimeoutMs?: number;
};
export type AssistantOptions = {
  model: AgentAdapter;
  source?: ToolSource;
  context?: ContextSource;
  review?: ReviewOptions;
  requiresConfirmation?: ConfirmationPolicy;
  developerMode?: boolean;
  theme?: Theme;
  maxRounds?: number;
  timeoutMs?: number;
  reviewTimeoutMs?: number;
};
export interface MountedAssistant extends Assistant {
  mount(target?: HTMLElement): void;
  unmount(): void;
  setTheme(theme: Theme): void;
}
