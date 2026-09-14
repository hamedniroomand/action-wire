export { createAgentBridge, openAICompatible } from '~/agent';
export { AgentError } from '~/core';
export { createWebMCPSource } from '~/webmcp';
export { createAssistant } from '~/widget';

export type { ErrorCode } from '~/core';
export type {
  ActionTarget,
  Activity,
  AgentAdapter,
  AgentTurn,
  Assistant,
  AssistantOptions,
  AssistantState,
  BridgeOptions,
  ConfirmationPolicy,
  ContextItem,
  ContextSnapshot,
  ContextSource,
  Json,
  Message,
  MountedAssistant,
  Proposal,
  ProposalPreview,
  ReviewOptions,
  TimelineItem,
  ToolCall,
  ToolDefinition,
  ToolResult,
  ToolSnapshot,
  ToolSource,
  ToolStatus,
  Theme,
} from '~/core';
