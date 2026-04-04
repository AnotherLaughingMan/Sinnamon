import { syncMatrixState } from '../matrix/matrixService';
import type { MatrixConfig, RoomMember, RoomSummary, TimelineMessage } from '../matrix/types';

type IncrementalSyncState = {
  rooms: RoomSummary[];
  messages: TimelineMessage[];
  membersByRoom: Record<string, RoomMember[]>;
  typingByRoom: Record<string, string[]>;
  nextBatch?: string;
};

type StartIncrementalSyncLoopOptions = {
  config: MatrixConfig;
  initialSyncToken: string;
  onIncrementalState: (state: IncrementalSyncState) => void;
  onNextBatchToken: (nextBatch: string) => void;
  onConnected: () => void;
  onError: (message: string) => void;
};

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

export function startIncrementalSyncLoop(options: StartIncrementalSyncLoopOptions): () => void {
  const { config, initialSyncToken, onIncrementalState, onNextBatchToken, onConnected, onError } = options;

  let canceled = false;
  let currentToken = initialSyncToken;
  let activeRequestController: AbortController | null = null;
  let cancelRetrySleep: (() => void) | null = null;

  const runLoop = async () => {
    while (!canceled) {
      activeRequestController = new AbortController();

      try {
        const incrementalState = await syncMatrixState(config, {
          since: currentToken,
          timeoutMs: 30000,
          signal: activeRequestController.signal,
        });

        if (canceled) {
          return;
        }

        onIncrementalState(incrementalState);
        if (incrementalState.nextBatch) {
          currentToken = incrementalState.nextBatch;
          onNextBatchToken(incrementalState.nextBatch);
        }
        onConnected();
      } catch (requestError) {
        if (canceled || isAbortError(requestError)) {
          return;
        }

        onError(requestError instanceof Error ? requestError.message : 'Incremental Matrix sync failed');

        await new Promise<void>((resolve) => {
          const timeoutId = setTimeout(() => {
            cancelRetrySleep = null;
            resolve();
          }, 5000);

          cancelRetrySleep = () => {
            clearTimeout(timeoutId);
            cancelRetrySleep = null;
            resolve();
          };
        });
      }
    }
  };

  void runLoop();

  return () => {
    canceled = true;
    activeRequestController?.abort();
    cancelRetrySleep?.();
  };
}
