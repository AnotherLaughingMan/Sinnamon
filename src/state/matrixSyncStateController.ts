import { syncMatrixState } from '../matrix/matrixService';
import type { ConnectionState, MatrixConfig, RoomMember, RoomSummary, TimelineMessage } from '../matrix/types';
import { dedupeRooms, markActiveRoomRead, trimMessages } from './matrixViewStateUtils';

export type SyncedMatrixState = {
  rooms: RoomSummary[];
  messages: TimelineMessage[];
  membersByRoom: Record<string, RoomMember[]>;
  typingByRoom: Record<string, string[]>;
  nextBatch?: string;
};

type SetState<T> = (value: T | ((previous: T) => T)) => void;

type ApplySyncedStateArgs = {
  syncedState: SyncedMatrixState;
  preferredRoomId: string;
  effectiveConfig: MatrixConfig;
  setRooms: SetState<RoomSummary[]>;
  setMessages: SetState<TimelineMessage[]>;
  setMembersByRoom: SetState<Record<string, RoomMember[]>>;
  setTypingByRoom: SetState<Record<string, string[]>>;
  setSelectedRoomId: SetState<string>;
  setSyncToken: SetState<string>;
  setActiveSessionFingerprint: SetState<string>;
  setConnectionState: SetState<ConnectionState>;
  setError: SetState<string>;
};

type ConnectMatrixSessionArgs = {
  config: MatrixConfig;
  overrideConfig?: MatrixConfig;
  selectedRoomId: string;
  setConnectionState: SetState<ConnectionState>;
  setError: SetState<string>;
  applySyncedState: (
    syncedState: SyncedMatrixState,
    preferredRoomId: string,
    effectiveConfig: MatrixConfig,
  ) => string;
};

export function getConfigFingerprint(config: MatrixConfig) {
  return `${config.homeserverUrl.trim()}|${config.userId.trim()}|${config.deviceId.trim()}|${config.accessToken.trim()}`;
}

export function applySyncedStateToView({
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
}: ApplySyncedStateArgs): string {
  if (syncedState.rooms.length === 0) {
    setConnectionState('error');
    setError('Connected, but no joined rooms were returned by sync.');
    return '';
  }

  const nextSelectedRoomId = syncedState.rooms.some((room) => room.id === preferredRoomId)
    ? preferredRoomId
    : syncedState.rooms[0].id;

  setRooms(markActiveRoomRead(dedupeRooms(syncedState.rooms), nextSelectedRoomId));
  setMessages(trimMessages(syncedState.messages));
  setMembersByRoom(syncedState.membersByRoom);
  setTypingByRoom(syncedState.typingByRoom);
  setSelectedRoomId(nextSelectedRoomId);
  setSyncToken(syncedState.nextBatch ?? '');
  setActiveSessionFingerprint(getConfigFingerprint(effectiveConfig));
  setConnectionState('connected');
  setError('');

  return nextSelectedRoomId;
}

export async function connectMatrixSession({
  config,
  overrideConfig,
  selectedRoomId,
  setConnectionState,
  setError,
  applySyncedState,
}: ConnectMatrixSessionArgs): Promise<void> {
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
    applySyncedState(syncedState, selectedRoomId, effectiveConfig);
  } catch (requestError) {
    setConnectionState('error');
    setError(requestError instanceof Error ? requestError.message : 'Unknown Matrix sync error');
  }
}
