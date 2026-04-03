import { afterEach, describe, expect, it, vi } from 'vitest';
import { mapMatrixMessageEvent, publishReadReceipt, sendRoomTextMessage } from './matrixService';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('mapMatrixMessageEvent', () => {
  it('maps m.text events to text timeline messages', () => {
    const message = mapMatrixMessageEvent('!room:hs', {
      event_id: '$1',
      sender: '@alice:hs',
      type: 'm.room.message',
      origin_server_ts: 100,
      content: {
        msgtype: 'm.text',
        body: 'hello',
      },
    });

    expect(message).toEqual({
      id: '$1',
      roomId: '!room:hs',
      author: '@alice:hs',
      content: 'hello',
      kind: 'text',
      timestamp: 100,
    });
  });

  it('maps m.notice events to notice timeline messages', () => {
    const message = mapMatrixMessageEvent('!room:hs', {
      event_id: '$2',
      sender: '@bot:hs',
      type: 'm.room.message',
      origin_server_ts: 101,
      content: {
        msgtype: 'm.notice',
        body: 'maintenance soon',
      },
    });

    expect(message?.kind).toBe('notice');
    expect(message?.content).toBe('maintenance soon');
  });

  it('maps m.image events and keeps media URL', () => {
    const message = mapMatrixMessageEvent('!room:hs', {
      event_id: '$3',
      sender: '@alice:hs',
      type: 'm.room.message',
      origin_server_ts: 102,
      content: {
        msgtype: 'm.image',
        body: 'photo.png',
        url: 'mxc://example.org/abc',
      },
    });

    expect(message?.kind).toBe('image');
    expect(message?.mediaUrl).toBe('mxc://example.org/abc');
    expect(message?.content).toBe('photo.png');
  });

  it('maps unknown msgtype as unsupported fallback', () => {
    const message = mapMatrixMessageEvent('!room:hs', {
      event_id: '$4',
      sender: '@alice:hs',
      type: 'm.room.message',
      origin_server_ts: 103,
      content: {
        msgtype: 'm.custom',
        body: 'custom payload',
      },
    });

    expect(message?.kind).toBe('unsupported');
    expect(message?.rawType).toBe('m.custom');
    expect(message?.content).toBe('custom payload');
  });

  it('returns null for non-message events and invalid text payloads', () => {
    const stateEvent = mapMatrixMessageEvent('!room:hs', {
      event_id: '$5',
      sender: '@alice:hs',
      type: 'm.room.topic',
      origin_server_ts: 104,
      content: {},
    });

    const blankText = mapMatrixMessageEvent('!room:hs', {
      event_id: '$6',
      sender: '@alice:hs',
      type: 'm.room.message',
      origin_server_ts: 105,
      content: {
        msgtype: 'm.text',
        body: '   ',
      },
    });

    expect(stateEvent).toBeNull();
    expect(blankText).toBeNull();
  });
});

describe('publishReadReceipt', () => {
  it('posts m.read receipt to the room receipt endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await publishReadReceipt(
      {
        homeserverUrl: 'https://matrix.example.com/',
        accessToken: 'token-123',
        userId: '@alice:example.com',
        rememberCredentials: false,
      },
      '!room:example.com',
      '$event:example.com',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://matrix.example.com/_matrix/client/v3/rooms/!room%3Aexample.com/receipt/m.read/%24event%3Aexample.com',
      {
        method: 'POST',
        signal: undefined,
        headers: {
          Authorization: 'Bearer token-123',
        },
      },
    );
  });

  it('throws if the receipt request fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      publishReadReceipt(
        {
          homeserverUrl: 'https://matrix.example.com',
          accessToken: 'token-123',
          userId: '@alice:example.com',
          rememberCredentials: false,
        },
        '!room:example.com',
        '$event:example.com',
      ),
    ).rejects.toThrow('Matrix read receipt failed with status 503');
  });
});

describe('sendRoomTextMessage', () => {
  it('puts m.room.message payload and returns event id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ event_id: '$sent:example.com' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const eventId = await sendRoomTextMessage(
      {
        homeserverUrl: 'https://matrix.example.com/',
        accessToken: 'token-123',
        userId: '@alice:example.com',
        rememberCredentials: false,
      },
      '!room:example.com',
      'hello world',
      'txn-123',
    );

    expect(eventId).toBe('$sent:example.com');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://matrix.example.com/_matrix/client/v3/rooms/!room%3Aexample.com/send/m.room.message/txn-123',
      {
        method: 'PUT',
        signal: undefined,
        headers: {
          Authorization: 'Bearer token-123',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          msgtype: 'm.text',
          body: 'hello world',
        }),
      },
    );
  });

  it('throws if sending message fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 429 });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      sendRoomTextMessage(
        {
          homeserverUrl: 'https://matrix.example.com',
          accessToken: 'token-123',
          userId: '@alice:example.com',
          rememberCredentials: false,
        },
        '!room:example.com',
        'retry later',
        'txn-429',
      ),
    ).rejects.toThrow('Matrix send message failed with status 429');
  });
});
