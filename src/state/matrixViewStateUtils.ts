import { MAX_MESSAGES_PER_ROOM, MAX_MESSAGES_TOTAL } from '../matrix/retention';
import type { RoomSummary, TimelineMessage } from '../matrix/types';

export function markActiveRoomRead(rooms: RoomSummary[], activeRoomId: string) {
  return rooms.map((room) =>
    room.id === activeRoomId && room.unreadCount > 0 ? { ...room, unreadCount: 0 } : room,
  );
}

export function trimMessages(messages: TimelineMessage[]) {
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

export function mergeRooms(previousRooms: RoomSummary[], nextRooms: RoomSummary[]) {
  const roomMap = new Map(previousRooms.map((room) => [room.id, room]));
  nextRooms.forEach((room) => {
    roomMap.set(room.id, room);
  });
  return Array.from(roomMap.values());
}

export function mergeMessages(previousMessages: TimelineMessage[], nextMessages: TimelineMessage[]) {
  const messageMap = new Map(previousMessages.map((message) => [message.id, message]));
  nextMessages.forEach((message) => {
    messageMap.set(message.id, message);
  });
  const sortedMessages = Array.from(messageMap.values()).sort(
    (left, right) => left.timestamp - right.timestamp,
  );
  return trimMessages(sortedMessages);
}
