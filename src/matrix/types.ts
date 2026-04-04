export type MatrixConfig = {
  homeserverUrl: string;
  accessToken: string;
  userId: string;
  deviceId: string;
  rememberCredentials: boolean;
};

export type RoomSummary = {
  id: string;
  name: string;
  topic: string;
  isDirect: boolean;
  isEncrypted: boolean;
  unreadCount: number;
};

export type RoomMember = {
  userId: string;
  displayName: string;
  membership: 'join' | 'invite' | 'leave' | 'ban';
};

export type TimelineMessageKind =
  | 'text'
  | 'notice'
  | 'emote'
  | 'image'
  | 'file'
  | 'encrypted'
  | 'unsupported';

export type TimelineMessage = {
  id: string;
  roomId: string;
  author: string;
  content: string;
  formattedBody?: string;
  kind: TimelineMessageKind;
  isEncrypted?: boolean;
  decryptionError?: string;
  rawType?: string;
  mediaUrl?: string;
  timestamp: number;
};

export type ConnectionState = 'mock' | 'connecting' | 'connected' | 'error';

export type MatrixKeyBackupInfo = {
  version: string;
  algorithm: string;
  count?: number;
  etag?: string;
};