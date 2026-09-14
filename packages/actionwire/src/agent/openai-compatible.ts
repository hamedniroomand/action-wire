import { createAliasTable } from '~/agent/alias';
import { clipForLog, createDebugLog, payloadForLog } from '~/agent/debug';
import { parseTurn, toProviderMessage } from '~/agent/openai-parse';
import { describePayload } from '~/agent/openai-shape';
import { AgentError } from '~/core';
import type { AgentAdapter, AgentTurn, ToolDefinition } from '~/core';
import { isAbortError } from '~/core/errors';

export type OpenAICompatibleOptions = {
  endpoint: string;
  debug?: boolean;
};

export function openAICompatible(options: OpenAICompatibleOptions): AgentAdapter {
  const aliases = createAliasTable();
  const log = createDebugLog('model', options.debug === true);
  return {
    async generate(input): Promise<AgentTurn> {
      const names = new Map(input.tools.map((tool) => [aliases.aliasFor(tool), tool.id]));
      let body: string;
      try {
        body = JSON.stringify({
          messages: input.messages.map((message) => toProviderMessage(message, aliases)),
          tools: input.tools.map((tool) => toProviderTool(tool, aliases.aliasFor(tool))),
        });
      } catch (error) {
        log('request-serialize', {
          error: String(error),
          messageCount: input.messages.length,
          toolCount: input.tools.length,
        });
        throw new AgentError('MODEL_ERROR', 'The model request failed.', { cause: error });
      }
      log('request', { messageCount: input.messages.length, toolCount: input.tools.length });
      let response: Response;
      try {
        response = await fetch(options.endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
          ...(input.signal === undefined ? {} : { signal: input.signal }),
        });
      } catch (error) {
        if (isAbortError(error)) {
          throw new AgentError('ABORTED', 'The model request was aborted.', { cause: error });
        }
        log('fetch', { error: String(error) });
        throw new AgentError('MODEL_ERROR', 'The model request failed.', { cause: error });
      }
      const bodyText = await response.text();
      if (!response.ok) {
        log('http', { status: response.status, body: clipForLog(bodyText) });
        throw new AgentError('MODEL_ERROR', 'The model request failed.');
      }
      let payload: unknown;
      try {
        payload = JSON.parse(bodyText);
      } catch (error) {
        log('json', { body: clipForLog(bodyText) });
        throw new AgentError('MODEL_ERROR', 'The model response is not valid JSON.', {
          cause: error,
        });
      }
      try {
        return parseTurn(payload, names);
      } catch (error) {
        if (error instanceof AgentError && error.code === 'MODEL_ERROR') {
          log('parse', {
            message: error.message,
            shape: describePayload(payload),
            payload: payloadForLog(payload),
          });
        }
        throw error;
      }
    },
  };
}

function toProviderTool(tool: ToolDefinition, name: string): Record<string, unknown> {
  return {
    type: 'function',
    function: {
      name,
      description:
        tool.title === undefined ? tool.description : `${tool.title}. ${tool.description}`,
      parameters: tool.inputSchema,
    },
  };
}
