/**
 * matrixMessageLifecycle.ts
 * 
 * Isolates message sending logic: optimistic updates, error recovery,
 * transaction ID generation, and pending message count management.
 * 
 * This module exports a factory function that creates a sendMessage callback
 * for use in useMatrixViewState, reducing hook complexity while maintaining
 * full control over message sending behavior.
 */

import { sendRoomTextMessage } from '../matrix/matrixService';
import type { MatrixConfig, TimelineMessage, ConnectionState } from '../matrix/types';
import { mergeMessages } from './matrixViewStateUtils';

type MessageSetters = {
  setMessages: (updater: (prev: TimelineMessage[]) => TimelineMessage[]) => void;
  setError: (error: string) => void;
  setPendingMessageCount: (updater: (prev: number) => number) => void;
};

/**
 * Creates a sendMessage callback for sending text messages to a Matrix room.
 * 
 * Handles:
 * - Input validation (content non-empty, room selected, connected)
 * - Transaction ID generation for message deduplication
 * - Optimistic message insertion and replacement on success
 * - Error recovery with message removal on failure
 * - Pending message count tracking
 * 
 * @param config - Current Matrix configuration
 * @param connectionState - Current connection state ('connected', 'connecting', etc.)
 * @param selectedRoomId - ID of the room to send to
 * @param setters - Object containing React setters for messages, error, and pending count
 * @returns A callback function that sends a message when invoked
 */
export function createSendMessageCallback(
  config: MatrixConfig,
  connectionState: ConnectionState,
  selectedRoomId: string,
  setters: MessageSetters,
) {
  return async (rawContent: string) => {
    const content = rawContent.trim();
    if (!content || !selectedRoomId) {
      return;
    }

    if (connectionState !== 'connected') {
      setters.setError('Connect to Matrix before sending messages.');
      return;
    }

    if (!config.homeserverUrl.trim() || !config.accessToken.trim()) {
      setters.setError('Add homeserver URL and access token to send messages.');
      return;
    }

    const txnId = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    const optimisticId = `local-${txnId}`;
    const optimisticMessage: TimelineMessage = {
      id: optimisticId,
      roomId: selectedRoomId,
      author: config.userId.trim() || 'you',
      content,
      kind: 'text',
      timestamp: Date.now(),
    };

    setters.setPendingMessageCount((previous) => previous + 1);
    setters.setError('');
    setters.setMessages((previousMessages) => mergeMessages(previousMessages, [optimisticMessage]));

    try {
      const eventId = await sendRoomTextMessage(config, selectedRoomId, content, txnId);

      if (eventId) {
        setters.setMessages((previousMessages) =>
          previousMessages.map((message) =>
            message.id === optimisticId ? { ...message, id: eventId } : message,
          ),
        );
      }
    } catch (requestError) {
      setters.setMessages((previousMessages) =>
        previousMessages.filter((message) => message.id !== optimisticId),
      );
      setters.setError(
        requestError instanceof Error ? requestError.message : 'Failed to send Matrix message',
      );
    } finally {
      setters.setPendingMessageCount((previous) => Math.max(previous - 1, 0));
    }
  };
}
