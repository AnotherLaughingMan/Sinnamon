import type { MatrixConfig, RoomSummary, TimelineMessage } from './types';

type MatrixEvent = {
  event_id?: string;
  sender?: string;
  type?: string;
  origin_server_ts?: number;
  state_key?: string;
  content?: Record<string, string | number | boolean | undefined>;
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
      if (event.type !== 'm.room.message') {
        return;
      }
      if (event.content?.msgtype !== 'm.text') {
        return;
      }
      if (typeof event.content.body !== 'string' || !event.content.body) {
        return;
      }

      messages.push({
        id: event.event_id ?? `${roomId}-${event.origin_server_ts ?? Date.now()}`,
        roomId,
        author: event.sender ?? 'unknown',
        content: event.content.body,
        timestamp: event.origin_server_ts ?? Date.now(),
      });
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