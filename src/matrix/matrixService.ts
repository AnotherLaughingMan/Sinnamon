import type {
  MatrixConfig,
  MatrixKeyBackupInfo,
  RoomMember,
  RoomSummary,
  TimelineMessage,
} from './types';
import { decryptTimelineEvent } from './matrixCryptoService';

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
        ephemeral?: {
          events?: MatrixEvent[];
        };
      }
    >;
  };
};

type SyncState = {
  rooms: RoomSummary[];
  messages: TimelineMessage[];
  membersByRoom: Record<string, RoomMember[]>;
  typingByRoom: Record<string, string[]>;
  nextBatch?: string;
};

type LoginWithPasswordOptions = {
  signal?: AbortSignal;
  initialDeviceDisplayName?: string;
  deviceId?: string;
  identifierType?: 'username' | 'email';
};

type LoginResponse = {
  access_token?: string;
  user_id?: string;
  device_id?: string;
  well_known?: {
    'm.homeserver'?: {
      base_url?: string;
    };
  };
};

type KeyBackupVersionResponse = {
  algorithm?: string;
  count?: number;
  etag?: string;
  version?: string;
};

function sanitizeBaseUrl(url: string) {
  return url.trim().replace(/\/+$/, '');
}

function getWellKnownHomeserverBaseUrl(payload: LoginResponse) {
  const baseUrl = payload.well_known?.['m.homeserver']?.base_url;
  return typeof baseUrl === 'string' && baseUrl.trim() ? sanitizeBaseUrl(baseUrl) : undefined;
}

function toMxidLocalpart(value: string) {
  return value.replace(/^@/, '').replace(/:.+$/, '');
}

function getMemberDisplayNameByUserId(roomStateEvents: MatrixEvent[] = []) {
  const displayNameByUserId = new Map<string, string>();
  for (const event of roomStateEvents) {
    if (event.type !== 'm.room.member' || !event.state_key) {
      continue;
    }

    const membership = typeof event.content?.membership === 'string' ? event.content.membership : 'join';
    if (membership !== 'join') {
      continue;
    }

    const displayName = typeof event.content?.displayname === 'string'
      ? event.content.displayname.trim()
      : '';
    displayNameByUserId.set(event.state_key, displayName || toMxidLocalpart(event.state_key));
  }

  return displayNameByUserId;
}

function resolveDirectRoomName(
  roomStateEvents: MatrixEvent[] = [],
  heroes: string[] = [],
  selfUserId?: string,
) {
  const displayNameByUserId = getMemberDisplayNameByUserId(roomStateEvents);
  const normalizedSelfUserId = selfUserId?.trim();

  const heroLabels = heroes
    .filter((heroUserId) => heroUserId !== normalizedSelfUserId)
    .map((heroUserId) => displayNameByUserId.get(heroUserId) ?? toMxidLocalpart(heroUserId));

  if (heroLabels.length > 0) {
    return heroLabels.slice(0, 3).join(', ');
  }

  const joinedLabels = Array.from(displayNameByUserId.entries())
    .filter(([userId]) => userId !== normalizedSelfUserId)
    .map(([, label]) => label);

  if (joinedLabels.length > 0) {
    return joinedLabels.slice(0, 3).join(', ');
  }

  return '';
}

function resolveRoomName(
  roomId: string,
  roomStateEvents: MatrixEvent[] = [],
  heroes: string[] = [],
  selfUserId?: string,
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

  const directName = resolveDirectRoomName(roomStateEvents, heroes, selfUserId);
  if (directName) {
    return directName;
  }

  if (heroes.length > 0) {
    const heroName = heroes
      .slice(0, 3)
      .map((hero) => toMxidLocalpart(hero))
      .join(', ');
    if (heroName) {
      return heroName;
    }
  }

  return roomId;
}

function hasExplicitRoomName(roomStateEvents: MatrixEvent[] = []) {
  const roomNameEvent = roomStateEvents.find((event) => event.type === 'm.room.name');
  const explicitRoomName = roomNameEvent?.content?.name;
  if (typeof explicitRoomName === 'string' && explicitRoomName.trim()) {
    return true;
  }

  const aliasEvent = roomStateEvents.find((event) => event.type === 'm.room.canonical_alias');
  const canonicalAlias = aliasEvent?.content?.alias;
  return typeof canonicalAlias === 'string' && canonicalAlias.trim().length > 0;
}

async function mapSyncToState(config: MatrixConfig, payload: SyncResponse): Promise<SyncState> {
  const joinedRooms = payload.rooms?.join ?? {};
  const rooms: RoomSummary[] = [];
  const messages: TimelineMessage[] = [];
  const membersByRoom: Record<string, RoomMember[]> = {};
  const typingByRoom: Record<string, string[]> = {};

  for (const [roomId, roomData] of Object.entries(joinedRooms)) {
    const roomStateEvents = roomData.state?.events ?? [];
    const unreadCount = roomData.unread_notifications?.notification_count ?? 0;
    const roomName = resolveRoomName(roomId, roomStateEvents, roomData.summary?.['m.heroes'] ?? [], config.userId);
    const joinedMembers = mapRoomMembers(roomStateEvents);
    const likelyDirect = !hasExplicitRoomName(roomStateEvents)
      && ((roomData.summary?.['m.heroes']?.length ?? 0) === 1 || joinedMembers.length === 2);

    const topicEvent = roomStateEvents.find((event) => event.type === 'm.room.topic');
    const topic =
      typeof topicEvent?.content?.topic === 'string' ? topicEvent.content.topic.trim() : '';

    rooms.push({
      id: roomId,
      name: roomName,
      topic,
      isDirect: likelyDirect,
      isEncrypted: roomStateEvents.some((event) => event.type === 'm.room.encryption'),
      unreadCount,
    });
    membersByRoom[roomId] = joinedMembers;

    const ephemeralEvents = roomData.ephemeral?.events ?? [];
    const typingEvent = ephemeralEvents.find((event) => event.type === 'm.typing');
    if (typingEvent) {
      const userIds = typingEvent.content?.user_ids;
      typingByRoom[roomId] = Array.isArray(userIds)
        ? (userIds.filter((id): id is string => typeof id === 'string'))
        : [];
    }

    const timelineEvents = roomData.timeline?.events ?? [];
    const resolvedTimelineEvents = await Promise.all(
      timelineEvents.map((event) => decryptTimelineEvent(config, roomId, event)),
    );
    resolvedTimelineEvents.forEach((resolvedEvent) => {
      const timelineMessage = mapMatrixMessageEvent(roomId, resolvedEvent.event, {
        isEncrypted: resolvedEvent.isEncrypted,
        decryptionError: resolvedEvent.decryptionError,
      });
      if (timelineMessage) {
        messages.push(timelineMessage);
      }
    });
  }

  messages.sort((left, right) => left.timestamp - right.timestamp);
  return {
    rooms,
    messages,
    membersByRoom,
    typingByRoom,
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

async function readResponseErrorDetails(response: Response) {
  try {
    const text = (await response.text()).trim();
    return text ? `: ${text}` : '';
  } catch {
    return '';
  }
}

async function publishReadMarkers(
  config: MatrixConfig,
  roomId: string,
  eventId: string,
  options: ReceiptOptions = {},
) {
  const homeserverUrl = sanitizeBaseUrl(config.homeserverUrl);
  const readMarkersUrl = `${homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/read_markers`;

  const response = await fetch(readMarkersUrl, {
    method: 'POST',
    signal: options.signal,
    headers: {
      Authorization: `Bearer ${config.accessToken.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      'm.fully_read': eventId,
      'm.read': eventId,
    }),
  });

  if (!response.ok) {
    const details = await readResponseErrorDetails(response);
    throw new Error(`Matrix read markers failed with status ${response.status}${details}`);
  }
}

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
  return mapSyncToState(config, payload);
}

export async function loginWithPassword(
  homeserverUrl: string,
  username: string,
  password: string,
  options: LoginWithPasswordOptions = {},
): Promise<MatrixConfig> {
  const sanitizedHomeserverUrl = sanitizeBaseUrl(homeserverUrl);
  const response = await fetch(`${sanitizedHomeserverUrl}/_matrix/client/v3/login`, {
    method: 'POST',
    signal: options.signal,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'm.login.password',
      identifier:
        options.identifierType === 'email'
          ? { type: 'm.id.thirdparty', medium: 'email', address: username.trim() }
          : { type: 'm.id.user', user: username.trim() },
      password,
      device_id: options.deviceId?.trim() || undefined,
      initial_device_display_name: options.initialDeviceDisplayName ?? 'Sinnamon',
    }),
  });

  if (!response.ok) {
    let errcode = '';
    try {
      const body = (await response.json()) as { errcode?: string; error?: string };
      if (typeof body.errcode === 'string') {
        errcode = ` (${body.errcode})`;
      }
    } catch {
      // ignore parse failure
    }
    throw new Error(`Matrix login failed with status ${response.status}${errcode}`);
  }

  const payload = (await response.json()) as LoginResponse;
  const accessToken = payload.access_token?.trim();
  const userId = payload.user_id?.trim();
  if (!accessToken || !userId) {
    throw new Error('Matrix login response did not include access token and user ID');
  }

  return {
    homeserverUrl: getWellKnownHomeserverBaseUrl(payload) ?? sanitizedHomeserverUrl,
    accessToken,
    userId,
    deviceId: payload.device_id?.trim() ?? '',
    rememberCredentials: false,
  };
}

export async function fetchKeyBackupVersion(
  config: MatrixConfig,
  options: { signal?: AbortSignal } = {},
): Promise<MatrixKeyBackupInfo | null> {
  const homeserverUrl = sanitizeBaseUrl(config.homeserverUrl);
  const response = await fetch(`${homeserverUrl}/_matrix/client/v3/room_keys/version`, {
    signal: options.signal,
    headers: {
      Authorization: `Bearer ${config.accessToken.trim()}`,
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Matrix key backup lookup failed with status ${response.status}`);
  }

  const payload = (await response.json()) as KeyBackupVersionResponse;
  if (!payload.version || !payload.algorithm) {
    throw new Error('Matrix key backup response was missing version metadata');
  }

  return {
    version: payload.version,
    algorithm: payload.algorithm,
    ...(typeof payload.count === 'number' ? { count: payload.count } : {}),
    ...(typeof payload.etag === 'string' ? { etag: payload.etag } : {}),
  };
}

export async function discoverHomeserverFromMxid(
  mxid: string,
  options: { signal?: AbortSignal } = {},
): Promise<string | null> {
  const match = /^@[^:]+:(.+)$/.exec(mxid.trim());
  if (!match) {
    return null;
  }
  const serverName = match[1];
  try {
    const response = await fetch(`https://${serverName}/.well-known/matrix/client`, {
      signal: options.signal,
    });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as {
      'm.homeserver'?: { base_url?: string };
    };
    const baseUrl = payload['m.homeserver']?.base_url;
    return typeof baseUrl === 'string' && baseUrl.trim() ? sanitizeBaseUrl(baseUrl) : null;
  } catch {
    return null;
  }
}

export async function publishReadReceipt(
  config: MatrixConfig,
  roomId: string,
  eventId: string,
  options: ReceiptOptions = {},
) {
  const trimmedRoomId = roomId.trim();
  const trimmedEventId = eventId.trim();
  if (!trimmedRoomId || !trimmedEventId.startsWith('$')) {
    throw new Error('Matrix read receipt requires a real Matrix room event ID.');
  }

  const homeserverUrl = sanitizeBaseUrl(config.homeserverUrl);
  const receiptUrl = `${homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(trimmedRoomId)}/receipt/m.read/${encodeURIComponent(trimmedEventId)}`;

  const response = await fetch(receiptUrl, {
    method: 'POST',
    signal: options.signal,
    headers: {
      Authorization: `Bearer ${config.accessToken.trim()}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });

  if (response.status === 400) {
    await publishReadMarkers(config, trimmedRoomId, trimmedEventId, options);
    return;
  }

  if (!response.ok) {
    const details = await readResponseErrorDetails(response);
    throw new Error(`Matrix read receipt failed with status ${response.status}${details}`);
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

export function mapRoomMembers(stateEvents: MatrixEvent[]) {
  const membersByUserId = new Map<string, RoomMember>();

  stateEvents.forEach((event) => {
    if (event.type !== 'm.room.member') {
      return;
    }

    const userId = event.state_key;
    if (!userId) {
      return;
    }

    const membershipRaw = getStringFromContent(event.content, 'membership');
    const membership: RoomMember['membership'] =
      membershipRaw === 'invite' || membershipRaw === 'leave' || membershipRaw === 'ban'
        ? membershipRaw
        : 'join';

    const displayName =
      getStringFromContent(event.content, 'displayname')?.trim() ||
      userId.replace(/^@/, '').replace(/:.+$/, '');

    if (membership !== 'join') {
      membersByUserId.delete(userId);
      return;
    }

    membersByUserId.set(userId, {
      userId,
      displayName,
      membership,
    });
  });

  return Array.from(membersByUserId.values()).sort((left, right) =>
    left.displayName.localeCompare(right.displayName),
  );
}

type RoomMembersResponse = {
  chunk?: MatrixEvent[];
};

type FetchMembersOptions = {
  signal?: AbortSignal;
};

export async function fetchRoomMemberList(
  config: MatrixConfig,
  roomId: string,
  options: FetchMembersOptions = {},
): Promise<RoomMember[]> {
  const homeserverUrl = sanitizeBaseUrl(config.homeserverUrl);
  const url = `${homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/members`;

  const response = await fetch(url, {
    signal: options.signal,
    headers: {
      Authorization: `Bearer ${config.accessToken.trim()}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Matrix room members fetch failed with status ${response.status}`);
  }

  const payload = (await response.json()) as RoomMembersResponse;
  return mapRoomMembers(payload.chunk ?? []);
}

type MessageMappingOptions = {
  isEncrypted?: boolean;
  decryptionError?: string;
};

export function mapMatrixMessageEvent(
  roomId: string,
  event: MatrixEvent,
  options: MessageMappingOptions = {},
): TimelineMessage | null {
  if (event.type === 'm.room.encrypted') {
    return {
      id: event.event_id ?? `${roomId}-${event.origin_server_ts ?? Date.now()}`,
      roomId,
      author: event.sender ?? 'unknown',
      content: 'Unable to decrypt this message yet.',
      kind: 'encrypted',
      isEncrypted: true,
      decryptionError: options.decryptionError ?? 'Import room keys or restore a backup for older encrypted history.',
      rawType: 'm.room.encrypted',
      timestamp: event.origin_server_ts ?? Date.now(),
    };
  }

  if (event.type !== 'm.room.message') {
    return null;
  }

  const msgType = getStringFromContent(event.content, 'msgtype') ?? 'm.text';
  const body = getStringFromContent(event.content, 'body')?.trim();
  const mediaUrl = getStringFromContent(event.content, 'url');

  const format = getStringFromContent(event.content, 'format');
  const rawFormattedBody = getStringFromContent(event.content, 'formatted_body');
  const htmlFormattedBody =
    format === 'org.matrix.custom.html' && rawFormattedBody ? rawFormattedBody : undefined;

  const baseMessage = {
    id: event.event_id ?? `${roomId}-${event.origin_server_ts ?? Date.now()}`,
    roomId,
    author: event.sender ?? 'unknown',
    ...(options.isEncrypted ? { isEncrypted: true } : {}),
    ...(options.decryptionError ? { decryptionError: options.decryptionError } : {}),
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
      ...(htmlFormattedBody ? { formattedBody: htmlFormattedBody } : {}),
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
      ...(htmlFormattedBody ? { formattedBody: htmlFormattedBody } : {}),
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

type TypingOptions = {
  signal?: AbortSignal;
};

export async function sendTypingNotification(
  config: MatrixConfig,
  roomId: string,
  typing: boolean,
  options: TypingOptions = {},
): Promise<void> {
  const homeserverUrl = sanitizeBaseUrl(config.homeserverUrl);
  const userId = encodeURIComponent(config.userId.trim());
  const url = `${homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/typing/${userId}`;

  const response = await fetch(url, {
    method: 'PUT',
    signal: options.signal,
    headers: {
      Authorization: `Bearer ${config.accessToken.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(typing ? { typing: true, timeout: 30000 } : { typing: false }),
  });

  if (!response.ok) {
    throw new Error(`Matrix typing notification failed with status ${response.status}`);
  }
}