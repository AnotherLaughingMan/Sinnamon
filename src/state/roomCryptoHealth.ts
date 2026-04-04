import type { RoomSummary, TimelineMessage } from '../matrix/types';

export type RoomCryptoHealth =
  | 'none'
  | 'healthy'
  | 'needs-backup-restore'
  | 'needs-key-import'
  | 'decryption-issues';

const MAX_RECENT_ROOM_MESSAGES = 25;

function isKeyBackupRestoreHint(error: string) {
  return (
    error.includes('HISTORICAL_MESSAGE_BACKUP_UNCONFIGURED') ||
    error.includes('HISTORICAL_MESSAGE_WORKING_BACKUP')
  );
}

function isKeyImportHint(error: string) {
  const normalizedError = error.toLowerCase();
  return (
    error.includes('HISTORICAL_MESSAGE_NO_KEY_BACKUP') ||
    error.includes('MEGOLM_UNKNOWN_INBOUND_SESSION_ID') ||
    (normalizedError.includes('sent before this device logged in') && normalizedError.includes('key backup is not working'))
  );
}

export function getRoomCryptoHealth(room: RoomSummary, allMessages: TimelineMessage[]): RoomCryptoHealth {
  if (!room.isEncrypted) {
    return 'none';
  }

  const recentMessages = allMessages
    .filter((message) => message.roomId === room.id)
    .slice(-MAX_RECENT_ROOM_MESSAGES);

  const encryptedFailures = recentMessages.filter((message) => message.kind === 'encrypted');
  if (encryptedFailures.length === 0) {
    return 'healthy';
  }

  const hasBackupRestoreHint = encryptedFailures.some((message) =>
    typeof message.decryptionError === 'string' && isKeyBackupRestoreHint(message.decryptionError),
  );
  if (hasBackupRestoreHint) {
    return 'needs-backup-restore';
  }

  const hasKeyImportHint = encryptedFailures.some((message) =>
    typeof message.decryptionError === 'string' && isKeyImportHint(message.decryptionError),
  );
  if (hasKeyImportHint) {
    return 'needs-key-import';
  }

  return 'decryption-issues';
}

export function getRoomCryptoHealthLabel(health: RoomCryptoHealth): string {
  if (health === 'healthy') {
    return 'Crypto Ready';
  }

  if (health === 'needs-backup-restore') {
    return 'Restore Backup';
  }

  if (health === 'needs-key-import') {
    return 'Import Keys';
  }

  if (health === 'decryption-issues') {
    return 'Check Crypto';
  }

  return '';
}