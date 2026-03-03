import type { RoomSummary, TimelineMessage } from './types';

export const MOCK_ROOMS: RoomSummary[] = [
  { id: 'mock-general', name: 'general', unreadCount: 2 },
  { id: 'mock-announcements', name: 'announcements', unreadCount: 0 },
  { id: 'mock-support', name: 'support', unreadCount: 1 },
  { id: 'mock-showcase', name: 'showcase', unreadCount: 0 },
];

export const MOCK_MESSAGES: TimelineMessage[] = [
  {
    id: 'm-1',
    roomId: 'mock-general',
    author: 'sinnamon-dev',
    content: 'Welcome to Sinnamon. Connect Matrix in settings when ready.',
    timestamp: Date.now() - 120000,
  },
  {
    id: 'm-2',
    roomId: 'mock-general',
    author: 'matrix-bot',
    content: 'This timeline is now state-driven and ready for Matrix sync.',
    timestamp: Date.now() - 60000,
  },
  {
    id: 'm-3',
    roomId: 'mock-support',
    author: 'helper',
    content: 'Ask setup questions here.',
    timestamp: Date.now() - 90000,
  },
];