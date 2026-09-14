import { abortFromSignal } from '~/agent/timeout';
import { AgentError } from '~/core';
import type { Proposal } from '~/core';

export type ReviewGate = {
  wake(): void;
  wait(turnSignal: AbortSignal): Promise<void>;
};

const OPEN: ReadonlySet<Proposal['status']> = new Set([
  'preparing',
  'needs-input',
  'ready-for-review',
]);

export function needsGate(proposals: readonly Proposal[]): boolean {
  return proposals.some((proposal) => OPEN.has(proposal.status));
}

export function needsReviewCancel(proposals: readonly Proposal[]): boolean {
  return proposals.some((proposal) => OPEN.has(proposal.status) || proposal.status === 'approved');
}

export function createReviewGate(reviewTimeoutMs: number | undefined): ReviewGate {
  let waiters: Array<() => void> = [];

  function drop(entry: () => void): void {
    waiters = waiters.filter((waiter) => waiter !== entry);
  }

  return {
    wake() {
      for (const waiter of waiters) waiter();
      waiters = [];
    },
    wait(turnSignal) {
      return new Promise((resolve, reject) => {
        let reviewTimer: ReturnType<typeof setTimeout> | undefined;
        const finish = () => {
          turnSignal.removeEventListener('abort', onAbort);
          if (reviewTimer !== undefined) clearTimeout(reviewTimer);
          drop(finish);
          resolve();
        };
        const onAbort = () => {
          turnSignal.removeEventListener('abort', onAbort);
          if (reviewTimer !== undefined) clearTimeout(reviewTimer);
          drop(finish);
          reject(abortFromSignal(turnSignal));
        };
        if (turnSignal.aborted) {
          onAbort();
          return;
        }
        turnSignal.addEventListener('abort', onAbort, { once: true });
        if (reviewTimeoutMs !== undefined) {
          reviewTimer = setTimeout(() => {
            onAbort();
            reject(new AgentError('TIMEOUT', 'The review timed out.'));
          }, reviewTimeoutMs);
        }
        waiters.push(finish);
      });
    },
  };
}
