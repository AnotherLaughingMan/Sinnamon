export type MatrixConfig = {
  homeserverUrl: string;
  accessToken: string;
  userId: string;
  rememberCredentials: boolean;
};

export type RoomSummary = {
  id: string;
  name: string;
  unreadCount: number;
};

export type TimelineMessageKind =
  | 'text'
  | 'notice'
  | 'emote'
  | 'image'
  | 'file'
  | 'unsupported';

export type TimelineMessage = {
  id: string;
  roomId: string;
  author: string;
  content: string;
  kind: TimelineMessageKind;
  rawType?: string;
  mediaUrl?: string;
  timestamp: number;
};

export type ConnectionState = 'mock' | 'connecting' | 'connected' | 'error';