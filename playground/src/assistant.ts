import { openAICompatible } from '@webmcp-agent/agent';
import { createAssistant } from 'webmcp-agent';

export function mountAssistant(): void {
  createAssistant({
    model: openAICompatible({ endpoint: '/api/assistant' }),
  }).mount();
}
