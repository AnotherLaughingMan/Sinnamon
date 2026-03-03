import { useCallback, useEffect, useMemo, useState } from 'react';
import { MOCK_MESSAGES, MOCK_ROOMS } from '../matrix/mockData';
import { MAX_MESSAGES_PER_ROOM, MAX_MESSAGES_TOTAL } from '../matrix/retention';
import { syncMatrixState } from '../matrix/matrixService';
import type { ConnectionState, MatrixConfig, RoomSummary, TimelineMessage } from '../matrix/types';

function markActiveRoomRead(rooms: RoomSummary[], activeRoomId: string) {
  return rooms.map((room) =>
    room.id === activeRoomId && room.unreadCount > 0 ? { ...room, unreadCount: 0 } : room,
  );
}

function trimMessages(messages: TimelineMessage[]) {
  const perRoomCount = new Map<string, number>();
  const kept: TimelineMessage[] = [];

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const currentCount = perRoomCount.get(message.roomId) ?? 0;
    if (currentCount >= MAX_MESSAGES_PER_ROOM) {
      continue;
    }
    perRoomCount.set(message.roomId, currentCount + 1);
    kept.push(message);
  }

  kept.reverse();
  if (kept.length <= MAX_MESSAGES_TOTAL) {
    return kept;
  }
  return kept.slice(-MAX_MESSAGES_TOTAL);
}

function mergeRooms(previousRooms: RoomSummary[], nextRooms: RoomSummary[]) {
  const roomMap = new Map(previousRooms.map((room) => [room.id, room]));
  nextRooms.forEach((room) => {
    roomMap.set(room.id, room);
  });
  return Array.from(roomMap.values());
}

function mergeMessages(previousMessages: TimelineMessage[], nextMessages: TimelineMessage[]) {
  const messageMap = new Map(previousMessages.map((message) => [message.id, message]));
  nextMessages.forEach((message) => {
    messageMap.set(message.id, message);
  });
  const sortedMessages = Array.from(messageMap.values()).sort(
    (left, right) => left.timestamp - right.timestamp,
  );
  return trimMessages(sortedMessages);
}

function getConfigFingerprint(config: MatrixConfig) {
  return `${config.homeserverUrl.trim()}|${config.userId.trim()}|${config.accessToken.trim()}`;
}

export function useMatrixViewState(config: MatrixConfig) {
  const [rooms, setRooms] = useState<RoomSummary[]>(MOCK_ROOMS);
  const [messages, setMessages] = useState<TimelineMessage[]>(MOCK_MESSAGES);
  const [selectedRoomId, setSelectedRoomId] = useState<string>(MOCK_ROOMS[0]?.id ?? '');
  const [connectionState, setConnectionState] = useState<ConnectionState>('mock');
  const [error, setError] = useState<string>('');
  const [syncToken, setSyncToken] = useState<string>('');
  const [activeSessionFingerprint, setActiveSessionFingerprint] = useState<string>('');

  const selectRoom = useCallback((roomId: string) => {
    setSelectedRoomId(roomId);
  }, []);

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

    const poll = async () => {
      let currentToken = syncToken;

      while (!canceled) {
        try {
          const incrementalState = await syncMatrixState(config, {
            since: currentToken,
            timeoutMs: 30000,
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
          if (canceled) {
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
    };
  }, [activeSessionFingerprint, config, selectedRoomId, syncToken]);

  useEffect(() => {
    if (!selectedRoomId) {
      return;
    }
    setRooms((previousRooms) => markActiveRoomRead(previousRooms, selectedRoomId));
  }, [selectedRoomId]);

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
    selectRoom,
  };
}