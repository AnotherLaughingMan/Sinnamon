export type MatrixConfig = {
  homeserverUrl: string;
  accessToken: string;
  userId: string;
};

export type RoomSummary = {
  id: string;
  name: string;
  unreadCount: number;
};

export type TimelineMessage = {
  id: string;
  roomId: string;
  author: string;
  content: string;
  timestamp: number;
};

export type ConnectionState = 'mock' | 'connecting' | 'connected' | 'error';