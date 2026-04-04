/**
 * matrixTypingLifecycle.ts
 * 
 * Isolates typing notification logic: precondition checks, state deduplication,
 * timeout management for auto-clearing typing state, and API calls.
 * 
 * Exports a factory function that creates a setTyping callback for use in
 * useMatrixViewState, reducing hook complexity while maintaining full control
 * over typing notification behavior.
 */

import { sendTypingNotification } from '../matrix/matrixService';
import type { MatrixConfig, ConnectionState } from '../matrix/types';

type TypingRefs = {
  typingActiveRef: React.MutableRefObject<boolean>;
  typingTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
};

/**
 * Creates a setTyping callback for sending and managing typing notifications.
 * 
 * Handles:
 * - Precondition checks (connected state, room selected, user ID present)
 * - Deduplication (don't send if typing state hasn't changed)
 * - Timeout management (28-second window for typing notifications)
 * - Auto-clearing typing state when timeout expires
 * - Error suppression for typing notification failures
 * 
 * @param config - Current Matrix configuration
 * @param connectionState - Current connection state ('connected', 'connecting', etc.)
 * @param selectedRoomId - ID of the room for typing notification
 * @param refs - Object containing typingActiveRef and typingTimeoutRef
 * @returns A callback function that manages typing state when invoked
 */
export function createSetTypingCallback(
  config: MatrixConfig,
  connectionState: ConnectionState,
  selectedRoomId: string,
  refs: TypingRefs,
) {
  return (typing: boolean) => {
    if (connectionState !== 'connected' || !selectedRoomId || !config.userId.trim()) {
      return;
    }

    if (typing === refs.typingActiveRef.current) {
      return;
    }

    refs.typingActiveRef.current = typing;

    if (refs.typingTimeoutRef.current) {
      clearTimeout(refs.typingTimeoutRef.current);
      refs.typingTimeoutRef.current = null;
    }

    sendTypingNotification(config, selectedRoomId, typing).catch(() => {});

    if (typing) {
      refs.typingTimeoutRef.current = setTimeout(() => {
        refs.typingActiveRef.current = false;
      }, 28000);
    }
  };
}
