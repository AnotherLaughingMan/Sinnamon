import type { RoomMember, RoomSummary, TimelineMessage } from './types';

export const MOCK_ROOMS: RoomSummary[] = [
  {
    id: 'mock-general',
    name: 'general',
    topic: 'General chat and announcements',
    isDirect: false,
    isEncrypted: true,
    unreadCount: 2,
  },
  {
    id: 'mock-announcements',
    name: 'announcements',
    topic: 'Official announcements only',
    isDirect: false,
    isEncrypted: false,
    unreadCount: 0,
  },
  {
    id: 'mock-support',
    name: 'support',
    topic: 'Get help with setup and issues',
    isDirect: false,
    isEncrypted: true,
    unreadCount: 1,
  },
  { id: 'mock-showcase', name: 'showcase', topic: '', isDirect: false, isEncrypted: false, unreadCount: 0 },
];

export const MOCK_MEMBERS_BY_ROOM: Record<string, RoomMember[]> = {
  'mock-general': [
    { userId: '@sinnamon-dev:example.com', displayName: 'sinnamon-dev', membership: 'join' },
    { userId: '@matrix-bot:example.com', displayName: 'matrix-bot', membership: 'join' },
    { userId: '@guest-user:example.com', displayName: 'guest-user', membership: 'join' },
  ],
  'mock-announcements': [
    { userId: '@announcer:example.com', displayName: 'announcer', membership: 'join' },
  ],
  'mock-support': [
    { userId: '@helper:example.com', displayName: 'helper', membership: 'join' },
    { userId: '@newcomer:example.com', displayName: 'newcomer', membership: 'join' },
  ],
  'mock-showcase': [
    { userId: '@artist:example.com', displayName: 'artist', membership: 'join' },
  ],
};

export const MOCK_MESSAGES: TimelineMessage[] = [
  {
    id: 'm-1',
    roomId: 'mock-general',
    author: 'sinnamon-dev',
    content: 'Welcome to Sinnamon. Connect Matrix in settings when ready.',
    kind: 'text',
    timestamp: Date.now() - 120000,
  },
  {
    id: 'm-2',
    roomId: 'mock-general',
    author: 'matrix-bot',
    content: 'This timeline is now state-driven and ready for Matrix sync.',
    kind: 'notice',
    timestamp: Date.now() - 60000,
  },
  {
    id: 'm-3',
    roomId: 'mock-support',
    author: 'helper',
    content: 'Ask setup questions here.',
    kind: 'text',
    timestamp: Date.now() - 90000,
  },
];