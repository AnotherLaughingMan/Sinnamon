import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MOCK_MEMBERS_BY_ROOM, MOCK_MESSAGES, MOCK_ROOMS } from '../matrix/mockData';
import { syncMatrixState } from '../matrix/matrixService';
import type { ConnectionState, MatrixConfig, RoomMember, RoomSummary, TimelineMessage } from '../matrix/types';
import {
  recoverMissingKeysFromBackup,
  type MissingKeysRecoveryResult,
  type VerificationSessionStatus,
} from '../matrix/matrixCryptoService';
import {
  dedupeRooms,
  markActiveRoomRead,
  mergeMessages,
  mergeRooms,
  trimMessages,
} from './matrixViewStateUtils';
import { startIncrementalSyncLoop } from './matrixSyncLifecycle';
import {
  applySyncedStateToView,
  connectMatrixSession,
  getConfigFingerprint,
} from './matrixSyncStateController';
import {
  getDmVerificationTargetUserId,
  loadIncomingDmVerificationRequest,
} from './matrixVerificationLifecycle';
import {
  getLatestRoomEventId,
  hasConnectedRoomContext,
  hydrateSelectedRoomMembers,
  publishLatestReadReceipt,
  shouldHydrateSelectedRoomMembers,
  shouldPublishReadReceipt,
} from './matrixRoomLifecycle';
import { createSendMessageCallback } from './matrixMessageLifecycle';
import { createSetTypingCallback } from './matrixTypingLifecycle';

export type MissingKeyRecoveryOutcome = {
  targetRoomId: string;
  undecryptableBefore: number;
  undecryptableAfter: number;
  backup: MissingKeysRecoveryResult;
  backupError?: string;
};

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

export function useMatrixViewState(config: MatrixConfig) {
  const [rooms, setRooms] = useState<RoomSummary[]>(MOCK_ROOMS);
  const [messages, setMessages] = useState<TimelineMessage[]>(MOCK_MESSAGES);
  const [selectedRoomId, setSelectedRoomId] = useState<string>(MOCK_ROOMS[0]?.id ?? '');
  const [connectionState, setConnectionState] = useState<ConnectionState>('mock');
  const [error, setError] = useState<string>('');
  const [membersByRoom, setMembersByRoom] = useState<Record<string, RoomMember[]>>(MOCK_MEMBERS_BY_ROOM);
  const [typingByRoom, setTypingByRoom] = useState<Record<string, string[]>>({});
  const [syncToken, setSyncToken] = useState<string>('');
  const [activeSessionFingerprint, setActiveSessionFingerprint] = useState<string>('');
  const [pendingMessageCount, setPendingMessageCount] = useState(0);
  const [pendingVerificationRequest, setPendingVerificationRequest] = useState<VerificationSessionStatus | null>(null);
  const lastPublishedReceiptByRoomRef = useRef(new Map<string, string>());
  const typingActiveRef = useRef(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedRoomIdRef = useRef(selectedRoomId);
  const activeSessionFingerprintRef = useRef(activeSessionFingerprint);
  const recoveryInProgressRef = useRef(false);
  const selectedRoomMemberCount = membersByRoom[selectedRoomId]?.length ?? 0;

  useEffect(() => {
    selectedRoomIdRef.current = selectedRoomId;
  }, [selectedRoomId]);

  useEffect(() => {
    activeSessionFingerprintRef.current = activeSessionFingerprint;
  }, [activeSessionFingerprint]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    };
  }, []);

  const applySyncedState = useCallback(
    (
      syncedState: {
        rooms: RoomSummary[];
        messages: TimelineMessage[];
        membersByRoom: Record<string, RoomMember[]>;
        typingByRoom: Record<string, string[]>;
        nextBatch?: string;
      },
      preferredRoomId: string,
      effectiveConfig: MatrixConfig,
    ) => {
      return applySyncedStateToView({
        syncedState,
        preferredRoomId,
        effectiveConfig,
        setRooms,
        setMessages,
        setMembersByRoom,
        setTypingByRoom,
        setSelectedRoomId,
        setSyncToken,
        setActiveSessionFingerprint,
        setConnectionState,
        setError,
      });
    },
    [setConnectionState, setError],
  );

  const selectRoom = useCallback((roomId: string) => {
    setSelectedRoomId(roomId);
  }, []);

  const setTyping = useCallback(
    createSetTypingCallback(config, connectionState, selectedRoomId, {
      typingActiveRef,
      typingTimeoutRef,
    }),
    [config, connectionState, selectedRoomId],
  );

  const sendMessage = useCallback(
    createSendMessageCallback(config, connectionState, selectedRoomId, {
      setMessages,
      setError,
      setPendingMessageCount,
    }),
    [config, connectionState, selectedRoomId],
  );

  const connect = useCallback(
    async (overrideConfig?: MatrixConfig) => {
      await connectMatrixSession({
        config,
        overrideConfig,
        selectedRoomId,
        setConnectionState,
        setError,
        applySyncedState,
      });
    },
    [applySyncedState, config, selectedRoomId],
  );

  const selectedRoomUndecryptableCount = useMemo(
    () => messages.filter((message) => message.roomId === selectedRoomId && Boolean(message.decryptionError)).length,
    [messages, selectedRoomId],
  );

  const recoverMissingKeys = useCallback(
    async (roomId?: string): Promise<MissingKeyRecoveryOutcome> => {
      if (recoveryInProgressRef.current) {
        throw new Error('A missing-key recovery is already in progress. Wait for it to complete before retrying.');
      }

      const targetRoomId = roomId?.trim() || selectedRoomId;
      if (!targetRoomId) {
        throw new Error('Select a room before recovering missing keys.');
      }

      recoveryInProgressRef.current = true;
      const expectedFingerprint = activeSessionFingerprintRef.current || getConfigFingerprint(config);

      const undecryptableBefore = messages.filter(
        (message) => message.roomId === targetRoomId && Boolean(message.decryptionError),
      ).length;

      let backup: MissingKeysRecoveryResult = {
        backupAvailable: false,
        backupPrivateKeyAvailable: false,
        attemptedBackupRestore: false,
        totalFromBackup: 0,
        importedFromBackup: 0,
      };
      let backupError = '';

      setConnectionState('connecting');
      setError('Recovering missing room keys and refreshing timeline...');

      try {
        backup = await recoverMissingKeysFromBackup(config);
      } catch (error) {
        backupError = error instanceof Error ? error.message : 'Missing-key backup restore failed.';
      }

      if (
        activeSessionFingerprintRef.current
        && activeSessionFingerprintRef.current !== expectedFingerprint
      ) {
        setConnectionState('error');
        setError('Session changed during missing-key recovery. Retry recovery for the active account.');
        throw new Error('Session changed during missing-key recovery. Retry recovery for the active account.');
      }

      try {
        const refreshedState = await syncMatrixState(config, { timeoutMs: 0 });
        applySyncedState(refreshedState, targetRoomId, config);

        const refreshedMessages = trimMessages(refreshedState.messages);
        const undecryptableAfter = refreshedMessages.filter(
          (message) => message.roomId === targetRoomId && Boolean(message.decryptionError),
        ).length;

        return {
          targetRoomId,
          undecryptableBefore,
          undecryptableAfter,
          backup,
          ...(backupError ? { backupError } : {}),
        };
      } catch (error) {
        setConnectionState('error');
        setError(error instanceof Error ? error.message : 'Missing-key recovery sync failed.');
        throw error;
      } finally {
        recoveryInProgressRef.current = false;
      }
    },
    [applySyncedState, config, messages, selectedRoomId],
  );

  useEffect(() => {
    if (!syncToken || !activeSessionFingerprint) {
      return;
    }

    if (!config.homeserverUrl.trim() || !config.accessToken.trim()) {
      return;
    }

    return startIncrementalSyncLoop({
      config,
      initialSyncToken: syncToken,
      onIncrementalState: (incrementalState) => {
        setRooms((previousRooms) =>
          markActiveRoomRead(mergeRooms(dedupeRooms(previousRooms), dedupeRooms(incrementalState.rooms)), selectedRoomIdRef.current),
        );
        setMessages((previousMessages) => mergeMessages(previousMessages, incrementalState.messages));
        setMembersByRoom((previousMembersByRoom) => ({
          ...previousMembersByRoom,
          ...incrementalState.membersByRoom,
        }));
        setTypingByRoom((previous) => ({
          ...previous,
          ...incrementalState.typingByRoom,
        }));
      },
      onNextBatchToken: (nextBatch) => {
        setSyncToken(nextBatch);
      },
      onConnected: () => {
        setError('');
        setConnectionState('connected');
      },
      onError: (message) => {
        setConnectionState('error');
        setError(message);
      },
    });
  }, [activeSessionFingerprint, config, syncToken]);

  useEffect(() => {
    if (!selectedRoomId) {
      return;
    }
    setRooms((previousRooms) => markActiveRoomRead(previousRooms, selectedRoomId));
  }, [selectedRoomId]);

  useEffect(() => {
    if (!hasConnectedRoomContext(config, connectionState, selectedRoomId)) {
      return;
    }

    const latestRoomEventId = getLatestRoomEventId(messages, selectedRoomId);
    if (!shouldPublishReadReceipt(selectedRoomId, latestRoomEventId, lastPublishedReceiptByRoomRef.current)) {
      return;
    }

    let canceled = false;
    const controller = new AbortController();

    publishLatestReadReceipt(config, selectedRoomId, latestRoomEventId, controller.signal)
      .then(() => {
        if (canceled) {
          return;
        }
        lastPublishedReceiptByRoomRef.current.set(selectedRoomId, latestRoomEventId);
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
    if (!shouldHydrateSelectedRoomMembers(config, connectionState, selectedRoomId, selectedRoomMemberCount)) {
      return;
    }

    let canceled = false;
    const controller = new AbortController();

    hydrateSelectedRoomMembers(config, selectedRoomId, controller.signal)
      .then((members) => {
        if (canceled) {
          return;
        }
        setMembersByRoom((previous) => ({
          ...previous,
          [selectedRoomId]: members,
        }));
      })
      .catch((requestError) => {
        if (canceled || isAbortError(requestError)) {
          return;
        }
      });

    return () => {
      canceled = true;
      controller.abort();
    };
  }, [config, connectionState, selectedRoomId, selectedRoomMemberCount]);

  useEffect(() => {
    if (connectionState !== 'connected' || !selectedRoomId) {
      setPendingVerificationRequest(null);
      return;
    }

    const targetUserId = getDmVerificationTargetUserId(selectedRoomId, membersByRoom, config.userId.trim());
    if (!targetUserId) {
      setPendingVerificationRequest(null);
      return;
    }

    let canceled = false;
    loadIncomingDmVerificationRequest(config, targetUserId, selectedRoomId)
      .then((request) => {
        if (canceled) {
          return;
        }
        setPendingVerificationRequest(request);
      })
      .catch(() => {
        if (!canceled) {
          setPendingVerificationRequest(null);
        }
      });

    return () => {
      canceled = true;
    };
  }, [config, connectionState, membersByRoom, selectedRoomId, messages]);

  useEffect(() => {
    if (rooms.length === 0) {
      return;
    }

    const roomIds = new Set(rooms.map((room) => room.id));

    const nextPublishedReceipts = new Map<string, string>();
    let receiptsChanged = false;
    for (const [roomId, eventId] of lastPublishedReceiptByRoomRef.current.entries()) {
      if (roomIds.has(roomId)) {
        nextPublishedReceipts.set(roomId, eventId);
      } else {
        receiptsChanged = true;
      }
    }
    if (receiptsChanged) {
      lastPublishedReceiptByRoomRef.current = nextPublishedReceipts;
    }

    setTypingByRoom((previous) => {
      let changed = false;
      const next: Record<string, string[]> = {};
      for (const [roomId, typingUsers] of Object.entries(previous)) {
        if (roomIds.has(roomId)) {
          next[roomId] = typingUsers;
        } else {
          changed = true;
        }
      }
      return changed ? next : previous;
    });
  }, [rooms]);

  useEffect(() => {
    const hasAnyConfigValue = Boolean(
      config.homeserverUrl.trim() || config.accessToken.trim() || config.userId.trim(),
    );

    if (!hasAnyConfigValue) {
      setRooms(MOCK_ROOMS);
      setMessages(MOCK_MESSAGES);
      setMembersByRoom(MOCK_MEMBERS_BY_ROOM);
      setTypingByRoom({});
      setSelectedRoomId(MOCK_ROOMS[0]?.id ?? '');
      setConnectionState('mock');
      setSyncToken('');
      setActiveSessionFingerprint('');
      setPendingMessageCount(0);
      setPendingVerificationRequest(null);
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
    setMembersByRoom({});
    setTypingByRoom({});
    setSelectedRoomId('');
    setSyncToken('');
    setActiveSessionFingerprint('');
    setPendingMessageCount(0);
    setPendingVerificationRequest(null);
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

  const selectedRoomMembers = useMemo(
    () => membersByRoom[selectedRoomId] ?? [],
    [membersByRoom, selectedRoomId],
  );

  const selectedRoomTyping = useMemo(() => {
    const typingUserIds = typingByRoom[selectedRoomId] ?? [];
    const selfId = config.userId.trim();
    const others = selfId ? typingUserIds.filter((id) => id !== selfId) : typingUserIds;
    const displayNameByUserId = new Map<string, string>();
    for (const member of (membersByRoom[selectedRoomId] ?? [])) {
      displayNameByUserId.set(member.userId, member.displayName);
    }
    return others.map((id) => displayNameByUserId.get(id) ?? id.replace(/^@/, '').replace(/:.+$/, ''));
  }, [config.userId, membersByRoom, selectedRoomId, typingByRoom]);

  return {
    rooms,
    roomMessages,
    selectedRoom,
    selectedRoomMembers,
    selectedRoomId,
    connectionState,
    error,
    connect,
    sendMessage,
    isSendingMessage: pendingMessageCount > 0,
    selectRoom,
    setTyping,
    selectedRoomTyping,
    selectedRoomUndecryptableCount,
    pendingVerificationRequest,
    recoverMissingKeys,
  };
}