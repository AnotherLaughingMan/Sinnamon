import { describe, expect, it } from 'vitest';
import { MAX_MESSAGES_PER_ROOM, MAX_MESSAGES_TOTAL } from '../matrix/retention';
import type { RoomSummary, TimelineMessage } from '../matrix/types';
import { dedupeRooms, markActiveRoomRead, mergeMessages, mergeRooms, trimMessages } from './matrixViewStateUtils';

function makeMessage(id: string, roomId: string, timestamp: number): TimelineMessage {
  return {
    id,
    roomId,
    author: '@user:example.com',
    content: `message-${id}`,
    kind: 'text',
    timestamp,
  };
}

describe('matrixViewStateUtils', () => {
  it('marks active room as read without mutating others', () => {
    const rooms: RoomSummary[] = [
      { id: '!a:hs', name: 'a', topic: '', isDirect: false, isEncrypted: false, unreadCount: 3 },
      { id: '!b:hs', name: 'b', topic: '', isDirect: true, isEncrypted: false, unreadCount: 2 },
    ];

    const result = markActiveRoomRead(rooms, '!b:hs');

    expect(result).toEqual([
      { id: '!a:hs', name: 'a', topic: '', isDirect: false, isEncrypted: false, unreadCount: 3 },
      { id: '!b:hs', name: 'b', topic: '', isDirect: true, isEncrypted: false, unreadCount: 0 },
    ]);
  });

  it('merges rooms by id and keeps latest room payload', () => {
    const previousRooms: RoomSummary[] = [
      { id: '!a:hs', name: 'A', topic: '', isDirect: false, isEncrypted: false, unreadCount: 1 },
      { id: '!b:hs', name: 'B', topic: '', isDirect: true, isEncrypted: false, unreadCount: 0 },
    ];
    const nextRooms: RoomSummary[] = [
      { id: '!b:hs', name: 'B renamed', topic: '', isDirect: true, isEncrypted: true, unreadCount: 5 },
      { id: '!c:hs', name: 'C', topic: '', isDirect: false, isEncrypted: false, unreadCount: 1 },
    ];

    const result = mergeRooms(previousRooms, nextRooms);

    expect(result).toEqual([
      { id: '!a:hs', name: 'A', topic: '', isDirect: false, isEncrypted: false, unreadCount: 1 },
      { id: '!b:hs', name: 'B renamed', topic: '', isDirect: true, isEncrypted: true, unreadCount: 5 },
      { id: '!c:hs', name: 'C', topic: '', isDirect: false, isEncrypted: false, unreadCount: 1 },
    ]);
  });

  it('preserves stable name and non-direct classification when sparse updates only provide fallback room id', () => {
    const previousRooms: RoomSummary[] = [
      { id: '!room:hs', name: 'General Chat', topic: 'Space talk', isDirect: false, isEncrypted: true, unreadCount: 1 },
    ];
    const nextRooms: RoomSummary[] = [
      { id: '!room:hs', name: '!room:hs', topic: '', isDirect: true, isEncrypted: false, unreadCount: 4 },
    ];

    const result = mergeRooms(previousRooms, nextRooms);

    expect(result).toEqual([
      { id: '!room:hs', name: 'General Chat', topic: 'Space talk', isDirect: false, isEncrypted: true, unreadCount: 4 },
    ]);
  });

  it('dedupes repeated room ids in the same payload', () => {
    const result = dedupeRooms([
      { id: '!room:hs', name: 'General Chat', topic: '', isDirect: false, isEncrypted: true, unreadCount: 1 },
      { id: '!room:hs', name: '!room:hs', topic: '', isDirect: true, isEncrypted: false, unreadCount: 2 },
    ]);

    expect(result).toEqual([
      { id: '!room:hs', name: 'General Chat', topic: '', isDirect: false, isEncrypted: true, unreadCount: 2 },
    ]);
  });

  it('deduplicates messages by id and keeps latest payload', () => {
    const previousMessages = [makeMessage('m1', '!a:hs', 1), makeMessage('m2', '!a:hs', 2)];
    const updatedM2 = {
      ...makeMessage('m2', '!a:hs', 2),
      content: 'edited',
    };
    const nextMessages = [updatedM2, makeMessage('m3', '!a:hs', 3)];

    const result = mergeMessages(previousMessages, nextMessages);

    expect(result).toEqual([makeMessage('m1', '!a:hs', 1), updatedM2, makeMessage('m3', '!a:hs', 3)]);
  });

  it('enforces per-room retention cap from newest backwards', () => {
    const overLimit = Array.from({ length: MAX_MESSAGES_PER_ROOM + 3 }, (_, index) =>
      makeMessage(`m${index + 1}`, '!a:hs', index + 1),
    );

    const result = trimMessages(overLimit);

    expect(result).toHaveLength(MAX_MESSAGES_PER_ROOM);
    expect(result[0]?.id).toBe('m4');
    expect(result.at(-1)?.id).toBe(`m${MAX_MESSAGES_PER_ROOM + 3}`);
  });

  it('enforces total retention cap across all rooms', () => {
    const messages = Array.from({ length: MAX_MESSAGES_TOTAL + 12 }, (_, index) =>
      makeMessage(`m${index + 1}`, `!r${index + 1}:hs`, index + 1),
    );

    const result = trimMessages(messages);

    expect(result).toHaveLength(MAX_MESSAGES_TOTAL);
    expect(result[0]?.id).toBe('m13');
    expect(result.at(-1)?.id).toBe(`m${MAX_MESSAGES_TOTAL + 12}`);
  });
});
