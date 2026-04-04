import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MatrixConfig } from './types';
import {
  fetchRoomMemberList,
  fetchKeyBackupVersion,
  loginWithPassword,
  mapMatrixMessageEvent,
  mapRoomMembers,
  publishReadReceipt,
  syncMatrixState,
  sendRoomTextMessage,
  sendTypingNotification,
} from './matrixService';

function makeConfig(overrides: Partial<MatrixConfig> = {}): MatrixConfig {
  return {
    homeserverUrl: 'https://matrix.example.com',
    accessToken: 'token-123',
    userId: '@alice:example.com',
    deviceId: '',
    rememberCredentials: false,
    ...overrides,
  };
}

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

  it('extracts formattedBody for m.text with org.matrix.custom.html format', () => {
    const message = mapMatrixMessageEvent('!room:hs', {
      event_id: '$html1',
      sender: '@alice:hs',
      type: 'm.room.message',
      origin_server_ts: 110,
      content: {
        msgtype: 'm.text',
        body: 'hello **world**',
        format: 'org.matrix.custom.html',
        formatted_body: 'hello <strong>world</strong>',
      },
    });

    expect(message?.content).toBe('hello **world**');
    expect(message?.formattedBody).toBe('hello <strong>world</strong>');
  });

  it('does not set formattedBody for m.text without HTML format', () => {
    const message = mapMatrixMessageEvent('!room:hs', {
      event_id: '$plain1',
      sender: '@alice:hs',
      type: 'm.room.message',
      origin_server_ts: 111,
      content: {
        msgtype: 'm.text',
        body: 'plain text only',
        formatted_body: 'would be ignored',
      },
    });

    expect(message?.formattedBody).toBeUndefined();
  });

  it('extracts formattedBody for m.notice with HTML format', () => {
    const message = mapMatrixMessageEvent('!room:hs', {
      event_id: '$notice-html',
      sender: '@bot:hs',
      type: 'm.room.message',
      origin_server_ts: 112,
      content: {
        msgtype: 'm.notice',
        body: 'notice plain',
        format: 'org.matrix.custom.html',
        formatted_body: '<em>notice html</em>',
      },
    });

    expect(message?.kind).toBe('notice');
    expect(message?.formattedBody).toBe('<em>notice html</em>');
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

  it('maps undecryptable encrypted events to encrypted placeholder messages', () => {
    const message = mapMatrixMessageEvent(
      '!room:hs',
      {
        event_id: '$enc1',
        sender: '@alice:hs',
        type: 'm.room.encrypted',
        origin_server_ts: 106,
        content: {
          algorithm: 'm.megolm.v1.aes-sha2',
        },
      },
      {
        isEncrypted: true,
        decryptionError: 'MEGOLM_UNKNOWN_INBOUND_SESSION_ID',
      },
    );

    expect(message).toEqual({
      id: '$enc1',
      roomId: '!room:hs',
      author: '@alice:hs',
      content: 'Unable to decrypt this message yet.',
      kind: 'encrypted',
      isEncrypted: true,
      decryptionError: 'MEGOLM_UNKNOWN_INBOUND_SESSION_ID',
      rawType: 'm.room.encrypted',
      timestamp: 106,
    });
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

describe('mapRoomMembers', () => {
  it('maps joined members and sorts by display name', () => {
    const members = mapRoomMembers([
      {
        type: 'm.room.member',
        state_key: '@z:example.com',
        content: { membership: 'join', displayname: 'Zulu' },
      },
      {
        type: 'm.room.member',
        state_key: '@a:example.com',
        content: { membership: 'join', displayname: 'Alpha' },
      },
    ]);

    expect(members).toEqual([
      { userId: '@a:example.com', displayName: 'Alpha', membership: 'join' },
      { userId: '@z:example.com', displayName: 'Zulu', membership: 'join' },
    ]);
  });

  it('excludes non-joined members and handles leave updates', () => {
    const members = mapRoomMembers([
      {
        type: 'm.room.member',
        state_key: '@guest:example.com',
        content: { membership: 'join', displayname: 'Guest' },
      },
      {
        type: 'm.room.member',
        state_key: '@guest:example.com',
        content: { membership: 'leave' },
      },
      {
        type: 'm.room.member',
        state_key: '@invited:example.com',
        content: { membership: 'invite' },
      },
    ]);

    expect(members).toEqual([]);
  });
});

describe('publishReadReceipt', () => {
  it('posts m.read receipt to the room receipt endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await publishReadReceipt(
      makeConfig({ homeserverUrl: 'https://matrix.example.com/' }),
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
          'Content-Type': 'application/json',
        },
        body: '{}',
      },
    );
  });

  it('falls back to read_markers when the receipt endpoint returns 400', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 400, text: () => Promise.resolve('{"errcode":"M_BAD_JSON"}') })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await publishReadReceipt(
      makeConfig({ homeserverUrl: 'https://matrix.example.com/' }),
      '!room:example.com',
      '$event:example.com',
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://matrix.example.com/_matrix/client/v3/rooms/!room%3Aexample.com/read_markers',
      {
        method: 'POST',
        signal: undefined,
        headers: {
          Authorization: 'Bearer token-123',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          'm.fully_read': '$event:example.com',
          'm.read': '$event:example.com',
        }),
      },
    );
  });

  it('throws if the receipt request fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503, text: () => Promise.resolve('') });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      publishReadReceipt(
        makeConfig(),
        '!room:example.com',
        '$event:example.com',
      ),
    ).rejects.toThrow('Matrix read receipt failed with status 503');
  });

  it('throws for non-Matrix event ids before making a request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      publishReadReceipt(makeConfig(), '!room:example.com', 'local-123'),
    ).rejects.toThrow('Matrix read receipt requires a real Matrix room event ID.');

    expect(fetchMock).not.toHaveBeenCalled();
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
      makeConfig({ homeserverUrl: 'https://matrix.example.com/' }),
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
        makeConfig(),
        '!room:example.com',
        'retry later',
        'txn-429',
      ),
    ).rejects.toThrow('Matrix send message failed with status 429');
  });
});

describe('fetchRoomMemberList', () => {
  it('fetches the members endpoint and returns mapped RoomMember array', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          chunk: [
            {
              type: 'm.room.member',
              state_key: '@bob:example.com',
              content: { membership: 'join', displayname: 'Bob' },
            },
            {
              type: 'm.room.member',
              state_key: '@alice:example.com',
              content: { membership: 'join', displayname: 'Alice' },
            },
          ],
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const members = await fetchRoomMemberList(
      makeConfig({ homeserverUrl: 'https://matrix.example.com/' }),
      '!room:example.com',
    );

    expect(members).toEqual([
      { userId: '@alice:example.com', displayName: 'Alice', membership: 'join' },
      { userId: '@bob:example.com', displayName: 'Bob', membership: 'join' },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://matrix.example.com/_matrix/client/v3/rooms/!room%3Aexample.com/members',
      {
        signal: undefined,
        headers: {
          Authorization: 'Bearer token-123',
        },
      },
    );
  });

  it('throws if the members request fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 403 });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchRoomMemberList(
        makeConfig(),
        '!room:example.com',
      ),
    ).rejects.toThrow('Matrix room members fetch failed with status 403');
  });
});

describe('sendTypingNotification', () => {
  it('puts typing=true with timeout to the typing endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await sendTypingNotification(
      makeConfig({ homeserverUrl: 'https://matrix.example.com/' }),
      '!room:example.com',
      true,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://matrix.example.com/_matrix/client/v3/rooms/!room%3Aexample.com/typing/%40alice%3Aexample.com',
      {
        method: 'PUT',
        signal: undefined,
        headers: {
          Authorization: 'Bearer token-123',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ typing: true, timeout: 30000 }),
      },
    );
  });

  it('puts typing=false to stop the typing indicator', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await sendTypingNotification(
      makeConfig(),
      '!room:example.com',
      false,
    );

    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(callBody).toEqual({ typing: false });
  });

  it('throws if the typing request fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 429 });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      sendTypingNotification(
        makeConfig(),
        '!room:example.com',
        true,
      ),
    ).rejects.toThrow('Matrix typing notification failed with status 429');
  });
});

describe('loginWithPassword', () => {
  it('posts Matrix password login and returns normalized session config', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: 'syt_result',
          user_id: '@alice:matrix.org',
          device_id: 'DEVICE123',
          well_known: {
            'm.homeserver': {
              base_url: 'https://matrix-client.matrix.org/',
            },
          },
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const config = await loginWithPassword('https://matrix.org/', 'alice', 'hunter2');

    expect(config).toEqual({
      homeserverUrl: 'https://matrix-client.matrix.org',
      accessToken: 'syt_result',
      userId: '@alice:matrix.org',
      deviceId: 'DEVICE123',
      rememberCredentials: false,
    });
    expect(fetchMock).toHaveBeenCalledWith('https://matrix.org/_matrix/client/v3/login', {
      method: 'POST',
      signal: undefined,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'm.login.password',
        identifier: {
          type: 'm.id.user',
          user: 'alice',
        },
        password: 'hunter2',
        initial_device_display_name: 'Sinnamon',
      }),
    });
  });

  it('throws if the login request fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 403 });
    vi.stubGlobal('fetch', fetchMock);

    await expect(loginWithPassword('https://matrix.org', 'alice', 'wrong-password')).rejects.toThrow(
      'Matrix login failed with status 403',
    );
  });

  it('reuses a provided device ID during password login', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: 'syt_result',
          user_id: '@alice:matrix.org',
          device_id: 'DEVICE123',
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await loginWithPassword('https://matrix.org/', 'alice', 'hunter2', {
      deviceId: 'DEVICE123',
    });

    const loginBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(loginBody.device_id).toBe('DEVICE123');
  });
});

describe('fetchKeyBackupVersion', () => {
  it('returns backup metadata when the server reports an active backup version', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          algorithm: 'm.megolm_backup.v1.curve25519-aes-sha2',
          version: '7',
          count: 42,
          etag: 'abc123',
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchKeyBackupVersion(makeConfig())).resolves.toEqual({
      version: '7',
      algorithm: 'm.megolm_backup.v1.curve25519-aes-sha2',
      count: 42,
      etag: 'abc123',
    });
  });

  it('returns null when the account has no server-side key backup', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchKeyBackupVersion(makeConfig())).resolves.toBeNull();
  });
});

describe('syncMatrixState', () => {
  it('maps encrypted rooms, topics, members, and typing state from sync', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          next_batch: 'batch-2',
          rooms: {
            join: {
              '!encrypted:matrix.org': {
                unread_notifications: { notification_count: 3 },
                summary: { 'm.heroes': ['@alice:matrix.org'] },
                state: {
                  events: [
                    { type: 'm.room.name', content: { name: 'secure' } },
                    { type: 'm.room.topic', content: { topic: 'Encrypted room topic' } },
                    { type: 'm.room.encryption', content: { algorithm: 'm.megolm.v1.aes-sha2' } },
                    {
                      type: 'm.room.member',
                      state_key: '@alice:matrix.org',
                      content: { membership: 'join', displayname: 'Alice' },
                    },
                  ],
                },
                ephemeral: {
                  events: [
                    { type: 'm.typing', content: { user_ids: ['@alice:matrix.org'] } },
                  ],
                },
                timeline: {
                  events: [
                    {
                      event_id: '$1',
                      sender: '@alice:matrix.org',
                      type: 'm.room.message',
                      origin_server_ts: 10,
                      content: { msgtype: 'm.text', body: 'hello' },
                    },
                  ],
                },
              },
            },
          },
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const state = await syncMatrixState(makeConfig());

    expect(state.rooms).toEqual([
      {
        id: '!encrypted:matrix.org',
        name: 'secure',
        topic: 'Encrypted room topic',
        isDirect: false,
        isEncrypted: true,
        unreadCount: 3,
      },
    ]);
    expect(state.membersByRoom['!encrypted:matrix.org']).toEqual([
      { userId: '@alice:matrix.org', displayName: 'Alice', membership: 'join' },
    ]);
    expect(state.typingByRoom['!encrypted:matrix.org']).toEqual(['@alice:matrix.org']);
    expect(state.nextBatch).toBe('batch-2');
  });

  it('uses direct-message member display names for unnamed DM rooms', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          next_batch: 'batch-3',
          rooms: {
            join: {
              '!dm:matrix.org': {
                unread_notifications: { notification_count: 1 },
                summary: { 'm.heroes': ['@X5URqNgGHX:matrix.org'] },
                state: {
                  events: [
                    {
                      type: 'm.room.member',
                      state_key: '@itsalaughingman:matrix.org',
                      content: { membership: 'join', displayname: 'ItsaLaughingMan' },
                    },
                    {
                      type: 'm.room.member',
                      state_key: '@X5URqNgGHX:matrix.org',
                      content: { membership: 'join', displayname: 'Shadow Sonata' },
                    },
                  ],
                },
                timeline: {
                  events: [
                    {
                      event_id: '$dm1',
                      sender: '@X5URqNgGHX:matrix.org',
                      type: 'm.room.message',
                      origin_server_ts: 20,
                      content: { msgtype: 'm.text', body: 'hi' },
                    },
                  ],
                },
              },
            },
          },
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const state = await syncMatrixState(makeConfig({ userId: '@itsalaughingman:matrix.org' }));

    expect(state.rooms).toEqual([
      {
        id: '!dm:matrix.org',
        name: 'Shadow Sonata',
        topic: '',
        isDirect: true,
        isEncrypted: false,
        unreadCount: 1,
      },
    ]);
  });

  it('does not classify sparse unnamed rooms as direct when only one joined member is visible', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          next_batch: 'batch-sparse',
          rooms: {
            join: {
              '!room:matrix.org': {
                unread_notifications: { notification_count: 2 },
                summary: { 'm.heroes': [] },
                state: {
                  events: [
                    {
                      type: 'm.room.member',
                      state_key: '@itsalaughingman:matrix.org',
                      content: { membership: 'join', displayname: 'ItsaLaughingMan' },
                    },
                  ],
                },
                timeline: {
                  events: [],
                },
              },
            },
          },
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const state = await syncMatrixState(makeConfig({ userId: '@itsalaughingman:matrix.org' }));

    expect(state.rooms).toEqual([
      {
        id: '!room:matrix.org',
        name: '!room:matrix.org',
        topic: '',
        isDirect: false,
        isEncrypted: false,
        unreadCount: 2,
      },
    ]);
  });
});
