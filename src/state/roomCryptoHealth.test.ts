import { describe, expect, it } from 'vitest';
import type { RoomSummary, TimelineMessage } from '../matrix/types';
import { getRoomCryptoHealth, getRoomCryptoHealthLabel } from './roomCryptoHealth';

function makeRoom(overrides: Partial<RoomSummary> = {}): RoomSummary {
  return {
    id: '!room:example.com',
    name: 'room',
    topic: '',
    isDirect: false,
    isEncrypted: true,
    unreadCount: 0,
    ...overrides,
  };
}

function makeMessage(overrides: Partial<TimelineMessage> = {}): TimelineMessage {
  return {
    id: '$1',
    roomId: '!room:example.com',
    author: '@alice:example.com',
    content: 'hello',
    kind: 'text',
    timestamp: 1,
    ...overrides,
  };
}

describe('getRoomCryptoHealth', () => {
  it('returns none for unencrypted rooms', () => {
    const health = getRoomCryptoHealth(
      makeRoom({ isEncrypted: false }),
      [makeMessage()],
    );

    expect(health).toBe('none');
  });

  it('returns healthy for encrypted rooms with no undecryptable messages', () => {
    const health = getRoomCryptoHealth(
      makeRoom(),
      [
        makeMessage({ kind: 'text' }),
        makeMessage({ id: '$2', kind: 'notice' }),
      ],
    );

    expect(health).toBe('healthy');
  });

  it('returns needs-backup-restore when recent failures indicate backup reconfiguration', () => {
    const health = getRoomCryptoHealth(
      makeRoom(),
      [
        makeMessage({
          kind: 'encrypted',
          decryptionError: 'HISTORICAL_MESSAGE_BACKUP_UNCONFIGURED',
        }),
      ],
    );

    expect(health).toBe('needs-backup-restore');
  });

  it('returns needs-key-import when failures indicate missing keys without server backup', () => {
    const health = getRoomCryptoHealth(
      makeRoom(),
      [
        makeMessage({
          kind: 'encrypted',
          decryptionError: 'MEGOLM_UNKNOWN_INBOUND_SESSION_ID',
        }),
      ],
    );

    expect(health).toBe('needs-key-import');
  });

  it('returns needs-key-import when rust crypto reports pre-login messages and non-working backup', () => {
    const health = getRoomCryptoHealth(
      makeRoom(),
      [
        makeMessage({
          kind: 'encrypted',
          decryptionError: 'This message was sent before this device logged in, and key backup is not working., sender_key: abc, session_id: xyz',
        }),
      ],
    );

    expect(health).toBe('needs-key-import');
  });

  it('returns decryption-issues for generic encrypted failures', () => {
    const health = getRoomCryptoHealth(
      makeRoom(),
      [
        makeMessage({
          kind: 'encrypted',
          decryptionError: 'UNKNOWN_ERROR',
        }),
      ],
    );

    expect(health).toBe('decryption-issues');
  });
});

describe('getRoomCryptoHealthLabel', () => {
  it('returns user-facing labels for each health state', () => {
    expect(getRoomCryptoHealthLabel('healthy')).toBe('Crypto Ready');
    expect(getRoomCryptoHealthLabel('needs-backup-restore')).toBe('Restore Backup');
    expect(getRoomCryptoHealthLabel('needs-key-import')).toBe('Import Keys');
    expect(getRoomCryptoHealthLabel('decryption-issues')).toBe('Check Crypto');
    expect(getRoomCryptoHealthLabel('none')).toBe('');
  });
});