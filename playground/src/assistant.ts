import { openAICompatible } from '@action-wire/agent';
import { createAssistant } from 'action-wire';

export function mountAssistant(): void {
  createAssistant({
    model: openAICompatible({ endpoint: '/api/assistant' }),
  }).mount();
}
