import { createAssistant, openAICompatible } from 'actionwire';

export function mountAssistant(): void {
  createAssistant({
    model: openAICompatible({ endpoint: '/api/assistant' }),
  }).mount();
}
