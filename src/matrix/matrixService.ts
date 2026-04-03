import type { MatrixConfig, RoomSummary, TimelineMessage } from './types';

type MatrixEvent = {
  event_id?: string;
  sender?: string;
  type?: string;
  origin_server_ts?: number;
  state_key?: string;
  content?: Record<string, unknown>;
};

type SyncResponse = {
  next_batch?: string;
  rooms?: {
    join?: Record<
      string,
      {
        timeline?: {
          events?: MatrixEvent[];
        };
        unread_notifications?: {
          notification_count?: number;
        };
        summary?: {
          'm.heroes'?: string[];
        };
        state?: {
          events?: MatrixEvent[];
        };
      }
    >;
  };
};

function sanitizeBaseUrl(url: string) {
  return url.trim().replace(/\/+$/, '');
}

function resolveRoomName(
  roomId: string,
  roomStateEvents: MatrixEvent[] = [],
  heroes: string[] = [],
) {
  const roomNameEvent = roomStateEvents.find((event) => event.type === 'm.room.name');
  const explicitRoomName = roomNameEvent?.content?.name;
  if (typeof explicitRoomName === 'string' && explicitRoomName.trim()) {
    return explicitRoomName;
  }

  const aliasEvent = roomStateEvents.find((event) => event.type === 'm.room.canonical_alias');
  const canonicalAlias = aliasEvent?.content?.alias;
  if (typeof canonicalAlias === 'string' && canonicalAlias.trim()) {
    return canonicalAlias.replace(/^#/, '');
  }

  if (heroes.length > 0) {
    const heroName = heroes
      .slice(0, 3)
      .map((hero) => hero.replace(/^@/, '').replace(/:.+$/, ''))
      .join(', ');
    if (heroName) {
      return heroName;
    }
  }

  return roomId;
}

function mapSyncToState(payload: SyncResponse) {
  const joinedRooms = payload.rooms?.join ?? {};
  const rooms: RoomSummary[] = [];
  const messages: TimelineMessage[] = [];

  Object.entries(joinedRooms).forEach(([roomId, roomData]) => {
    const unreadCount = roomData.unread_notifications?.notification_count ?? 0;
    const roomName = resolveRoomName(
      roomId,
      roomData.state?.events ?? [],
      roomData.summary?.['m.heroes'] ?? [],
    );
    rooms.push({
      id: roomId,
      name: roomName,
      unreadCount,
    });

    const timelineEvents = roomData.timeline?.events ?? [];
    timelineEvents.forEach((event) => {
      const timelineMessage = mapMatrixMessageEvent(roomId, event);
      if (timelineMessage) {
        messages.push(timelineMessage);
      }
    });
  });

  messages.sort((left, right) => left.timestamp - right.timestamp);
  return {
    rooms,
    messages,
    nextBatch: payload.next_batch,
  };
}

type SyncOptions = {
  since?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
};

type ReceiptOptions = {
  signal?: AbortSignal;
};

type SendMessageOptions = {
  signal?: AbortSignal;
};

export async function syncMatrixState(config: MatrixConfig, options: SyncOptions = {}) {
  const homeserverUrl = sanitizeBaseUrl(config.homeserverUrl);
  const search = new URLSearchParams();
  search.set('timeout', String(options.timeoutMs ?? 0));
  if (options.since) {
    search.set('since', options.since);
  }
  const syncUrl = `${homeserverUrl}/_matrix/client/v3/sync?${search.toString()}`;

  const response = await fetch(syncUrl, {
    signal: options.signal,
    headers: {
      Authorization: `Bearer ${config.accessToken.trim()}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Matrix sync failed with status ${response.status}`);
  }

  const payload = (await response.json()) as SyncResponse;
  return mapSyncToState(payload);
}

export async function publishReadReceipt(
  config: MatrixConfig,
  roomId: string,
  eventId: string,
  options: ReceiptOptions = {},
) {
  const homeserverUrl = sanitizeBaseUrl(config.homeserverUrl);
  const receiptUrl = `${homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/receipt/m.read/${encodeURIComponent(eventId)}`;

  const response = await fetch(receiptUrl, {
    method: 'POST',
    signal: options.signal,
    headers: {
      Authorization: `Bearer ${config.accessToken.trim()}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Matrix read receipt failed with status ${response.status}`);
  }
}

type SendMessageResponse = {
  event_id?: string;
};

export async function sendRoomTextMessage(
  config: MatrixConfig,
  roomId: string,
  body: string,
  txnId: string,
  options: SendMessageOptions = {},
) {
  const homeserverUrl = sanitizeBaseUrl(config.homeserverUrl);
  const sendUrl = `${homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${encodeURIComponent(txnId)}`;

  const response = await fetch(sendUrl, {
    method: 'PUT',
    signal: options.signal,
    headers: {
      Authorization: `Bearer ${config.accessToken.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      msgtype: 'm.text',
      body,
    }),
  });

  if (!response.ok) {
    throw new Error(`Matrix send message failed with status ${response.status}`);
  }

  const payload = (await response.json()) as SendMessageResponse;
  return payload.event_id;
}

function getStringFromContent(content: Record<string, unknown> | undefined, key: string) {
  const value = content?.[key];
  return typeof value === 'string' ? value : undefined;
}

export function mapMatrixMessageEvent(roomId: string, event: MatrixEvent): TimelineMessage | null {
  if (event.type !== 'm.room.message') {
    return null;
  }

  const msgType = getStringFromContent(event.content, 'msgtype') ?? 'm.text';
  const body = getStringFromContent(event.content, 'body')?.trim();
  const mediaUrl = getStringFromContent(event.content, 'url');

  const baseMessage = {
    id: event.event_id ?? `${roomId}-${event.origin_server_ts ?? Date.now()}`,
    roomId,
    author: event.sender ?? 'unknown',
    timestamp: event.origin_server_ts ?? Date.now(),
  };

  if (msgType === 'm.text') {
    if (!body) {
      return null;
    }

    return {
      ...baseMessage,
      kind: 'text',
      content: body,
    };
  }

  if (msgType === 'm.notice') {
    if (!body) {
      return null;
    }

    return {
      ...baseMessage,
      kind: 'notice',
      content: body,
    };
  }

  if (msgType === 'm.emote') {
    if (!body) {
      return null;
    }

    return {
      ...baseMessage,
      kind: 'emote',
      content: body,
    };
  }

  if (msgType === 'm.image') {
    return {
      ...baseMessage,
      kind: 'image',
      content: body ?? 'Image',
      mediaUrl,
    };
  }

  if (msgType === 'm.file') {
    return {
      ...baseMessage,
      kind: 'file',
      content: body ?? 'File',
      mediaUrl,
    };
  }

  return {
    ...baseMessage,
    kind: 'unsupported',
    rawType: msgType,
    content: body ?? 'Unsupported message type',
    mediaUrl,
  };
}