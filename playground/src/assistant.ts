import { createAssistant, openAICompatible } from 'action-wire';

export function mountAssistant(): void {
  createAssistant({
    model: openAICompatible({ endpoint: '/api/assistant' }),
  }).mount();
}
