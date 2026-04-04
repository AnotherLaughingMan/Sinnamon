import { fetchRoomMemberList, publishReadReceipt } from '../matrix/matrixService';
import type { ConnectionState, MatrixConfig, RoomMember, TimelineMessage } from '../matrix/types';

export function hasConnectedRoomContext(
  config: MatrixConfig,
  connectionState: ConnectionState,
  selectedRoomId: string,
): boolean {
  if (!selectedRoomId || connectionState !== 'connected') {
    return false;
  }

  return Boolean(config.homeserverUrl.trim() && config.accessToken.trim());
}

export function getLatestRoomEventId(messages: TimelineMessage[], selectedRoomId: string): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.roomId === selectedRoomId && message.id.startsWith('$')) {
      return message.id;
    }
  }

  return '';
}

export function shouldPublishReadReceipt(
  selectedRoomId: string,
  latestRoomEventId: string,
  lastPublishedReceiptByRoom: Map<string, string>,
): boolean {
  if (!selectedRoomId || !latestRoomEventId) {
    return false;
  }

  return lastPublishedReceiptByRoom.get(selectedRoomId) !== latestRoomEventId;
}

export async function publishLatestReadReceipt(
  config: MatrixConfig,
  selectedRoomId: string,
  latestRoomEventId: string,
  signal: AbortSignal,
): Promise<void> {
  await publishReadReceipt(config, selectedRoomId, latestRoomEventId, { signal });
}

export function shouldHydrateSelectedRoomMembers(
  config: MatrixConfig,
  connectionState: ConnectionState,
  selectedRoomId: string,
  selectedRoomMemberCount: number,
): boolean {
  if (selectedRoomMemberCount > 0) {
    return false;
  }

  return hasConnectedRoomContext(config, connectionState, selectedRoomId);
}

export async function hydrateSelectedRoomMembers(
  config: MatrixConfig,
  selectedRoomId: string,
  signal: AbortSignal,
): Promise<RoomMember[]> {
  return fetchRoomMemberList(config, selectedRoomId, { signal });
}
