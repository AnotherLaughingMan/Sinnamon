import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MOCK_MESSAGES, MOCK_ROOMS } from '../matrix/mockData';
import { publishReadReceipt, sendRoomTextMessage, syncMatrixState } from '../matrix/matrixService';
import type { ConnectionState, MatrixConfig, RoomSummary, TimelineMessage } from '../matrix/types';
import {
  markActiveRoomRead,
  mergeMessages,
  mergeRooms,
  trimMessages,
} from './matrixViewStateUtils';

function getConfigFingerprint(config: MatrixConfig) {
  return `${config.homeserverUrl.trim()}|${config.userId.trim()}|${config.accessToken.trim()}`;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

function isMatrixEventId(value: string) {
  return value.startsWith('$');
}

export function useMatrixViewState(config: MatrixConfig) {
  const [rooms, setRooms] = useState<RoomSummary[]>(MOCK_ROOMS);
  const [messages, setMessages] = useState<TimelineMessage[]>(MOCK_MESSAGES);
  const [selectedRoomId, setSelectedRoomId] = useState<string>(MOCK_ROOMS[0]?.id ?? '');
  const [connectionState, setConnectionState] = useState<ConnectionState>('mock');
  const [error, setError] = useState<string>('');
  const [syncToken, setSyncToken] = useState<string>('');
  const [activeSessionFingerprint, setActiveSessionFingerprint] = useState<string>('');
  const [pendingMessageCount, setPendingMessageCount] = useState(0);
  const lastPublishedReceiptByRoomRef = useRef(new Map<string, string>());

  const selectRoom = useCallback((roomId: string) => {
    setSelectedRoomId(roomId);
  }, []);

  const sendMessage = useCallback(
    async (rawContent: string) => {
      const content = rawContent.trim();
      if (!content || !selectedRoomId) {
        return;
      }

      if (connectionState !== 'connected') {
        setError('Connect to Matrix before sending messages.');
        return;
      }

      if (!config.homeserverUrl.trim() || !config.accessToken.trim()) {
        setError('Add homeserver URL and access token to send messages.');
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

      setPendingMessageCount((previous) => previous + 1);
      setError('');
      setMessages((previousMessages) => mergeMessages(previousMessages, [optimisticMessage]));

      try {
        const eventId = await sendRoomTextMessage(config, selectedRoomId, content, txnId);

        if (eventId) {
          setMessages((previousMessages) =>
            previousMessages.map((message) =>
              message.id === optimisticId ? { ...message, id: eventId } : message,
            ),
          );
        }
      } catch (requestError) {
        setMessages((previousMessages) =>
          previousMessages.filter((message) => message.id !== optimisticId),
        );
        setError(
          requestError instanceof Error ? requestError.message : 'Failed to send Matrix message',
        );
      } finally {
        setPendingMessageCount((previous) => Math.max(previous - 1, 0));
      }
    },
    [config, connectionState, selectedRoomId],
  );

  const connect = useCallback(
    async (overrideConfig?: MatrixConfig) => {
      const effectiveConfig = overrideConfig ?? config;

      if (!effectiveConfig.homeserverUrl.trim() || !effectiveConfig.accessToken.trim()) {
        setConnectionState('mock');
        setError('Add homeserver URL and access token to connect Matrix state.');
        return;
      }

      setConnectionState('connecting');
      setError('');

      try {
        const syncedState = await syncMatrixState(effectiveConfig, {
          timeoutMs: 0,
        });
        if (syncedState.rooms.length === 0) {
          setConnectionState('error');
          setError('Connected, but no joined rooms were returned by sync.');
          return;
        }

        const nextSelectedRoomId = syncedState.rooms.some((room) => room.id === selectedRoomId)
          ? selectedRoomId
          : syncedState.rooms[0].id;
        setRooms(markActiveRoomRead(syncedState.rooms, nextSelectedRoomId));
        setMessages(trimMessages(syncedState.messages));
        setSelectedRoomId(nextSelectedRoomId);
        setSyncToken(syncedState.nextBatch ?? '');
        setActiveSessionFingerprint(getConfigFingerprint(effectiveConfig));
        setConnectionState('connected');
      } catch (requestError) {
        setConnectionState('error');
        setError(requestError instanceof Error ? requestError.message : 'Unknown Matrix sync error');
      }
    },
    [config, selectedRoomId],
  );

  useEffect(() => {
    if (!syncToken || !activeSessionFingerprint) {
      return;
    }

    if (!config.homeserverUrl.trim() || !config.accessToken.trim()) {
      return;
    }

    let canceled = false;
    let activeRequestController: AbortController | null = null;

    const poll = async () => {
      let currentToken = syncToken;

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

          setRooms((previousRooms) =>
            markActiveRoomRead(mergeRooms(previousRooms, incrementalState.rooms), selectedRoomId),
          );
          setMessages((previousMessages) => mergeMessages(previousMessages, incrementalState.messages));
          if (incrementalState.nextBatch) {
            currentToken = incrementalState.nextBatch;
            setSyncToken(incrementalState.nextBatch);
          }
          setError('');
          setConnectionState('connected');
        } catch (requestError) {
          if (canceled || isAbortError(requestError)) {
            return;
          }
          setConnectionState('error');
          setError(
            requestError instanceof Error ? requestError.message : 'Incremental Matrix sync failed',
          );
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }
    };

    poll();

    return () => {
      canceled = true;
      activeRequestController?.abort();
    };
  }, [activeSessionFingerprint, config, selectedRoomId, syncToken]);

  useEffect(() => {
    if (!selectedRoomId) {
      return;
    }
    setRooms((previousRooms) => markActiveRoomRead(previousRooms, selectedRoomId));
  }, [selectedRoomId]);

  useEffect(() => {
    if (!selectedRoomId || connectionState !== 'connected') {
      return;
    }

    if (!config.homeserverUrl.trim() || !config.accessToken.trim()) {
      return;
    }

    const latestRoomMessage = [...messages]
      .reverse()
      .find((message) => message.roomId === selectedRoomId && isMatrixEventId(message.id));

    if (!latestRoomMessage) {
      return;
    }

    const lastPublishedEventId = lastPublishedReceiptByRoomRef.current.get(selectedRoomId);
    if (lastPublishedEventId === latestRoomMessage.id) {
      return;
    }

    let canceled = false;
    const controller = new AbortController();

    publishReadReceipt(config, selectedRoomId, latestRoomMessage.id, {
      signal: controller.signal,
    })
      .then(() => {
        if (canceled) {
          return;
        }
        lastPublishedReceiptByRoomRef.current.set(selectedRoomId, latestRoomMessage.id);
        setRooms((previousRooms) => markActiveRoomRead(previousRooms, selectedRoomId));
      })
      .catch((requestError) => {
        if (canceled || isAbortError(requestError)) {
          return;
        }
        setError('Unable to publish read receipt; unread counts may be temporarily stale.');
      });

    return () => {
      canceled = true;
      controller.abort();
    };
  }, [config, connectionState, messages, selectedRoomId]);

  useEffect(() => {
    const hasAnyConfigValue = Boolean(
      config.homeserverUrl.trim() || config.accessToken.trim() || config.userId.trim(),
    );

    if (!hasAnyConfigValue) {
      setRooms(MOCK_ROOMS);
      setMessages(MOCK_MESSAGES);
      setSelectedRoomId(MOCK_ROOMS[0]?.id ?? '');
      setConnectionState('mock');
      setSyncToken('');
      setActiveSessionFingerprint('');
      setPendingMessageCount(0);
      lastPublishedReceiptByRoomRef.current = new Map();
      setError('Using mock data. Open settings to connect your Matrix account.');
      return;
    }

    const nextFingerprint = getConfigFingerprint(config);
    if (activeSessionFingerprint && nextFingerprint === activeSessionFingerprint) {
      return;
    }

    setRooms([]);
    setMessages([]);
    setSelectedRoomId('');
    setSyncToken('');
    setActiveSessionFingerprint('');
    setPendingMessageCount(0);
    lastPublishedReceiptByRoomRef.current = new Map();
    setConnectionState('connecting');
    setError('Connection settings changed. Connect to load rooms for this account.');
  }, [activeSessionFingerprint, config]);

  const roomMessages = useMemo(
    () => messages.filter((message) => message.roomId === selectedRoomId),
    [messages, selectedRoomId],
  );

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedRoomId),
    [rooms, selectedRoomId],
  );

  return {
    rooms,
    roomMessages,
    selectedRoom,
    selectedRoomId,
    connectionState,
    error,
    connect,
    sendMessage,
    isSendingMessage: pendingMessageCount > 0,
    selectRoom,
  };
}