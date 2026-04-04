import type { MatrixConfig } from '../../matrix/types';
import type { RoomKeyImportProgress, RoomKeyImportResult } from '../../matrix/matrixCryptoService';

type SetStatus = (value: string) => void;

type ImportRoomKeysArgs = {
  draft: MatrixConfig;
  roomKeysJson: string;
  roomKeysPassphrase: string;
  onImportRoomKeys: (
    value: MatrixConfig,
    exportedKeysJson: string,
    importPassphrase?: string,
    onProgress?: (progress: RoomKeyImportProgress) => void,
  ) => Promise<RoomKeyImportResult>;
  onConnect: (value: MatrixConfig) => void | Promise<void>;
  setRoomKeysStatus: SetStatus;
};

type ExportRoomKeysArgs = {
  draft: MatrixConfig;
  onExportRoomKeys: (value: MatrixConfig) => Promise<string>;
  setRoomKeysStatus: SetStatus;
};

export async function importRoomKeysWithStatus({
  draft,
  roomKeysJson,
  roomKeysPassphrase,
  onImportRoomKeys,
  onConnect,
  setRoomKeysStatus,
}: ImportRoomKeysArgs): Promise<void> {
  setRoomKeysStatus('Starting key import...');

  const result = await onImportRoomKeys(draft, roomKeysJson, roomKeysPassphrase, (progress) => {
    setRoomKeysStatus(
      `Importing room keys: ${progress.successes}/${progress.total} loaded${progress.failures > 0 ? `, ${progress.failures} failed` : ''}.`,
    );
  });

  await onConnect(draft);

  if (result.imported === 0) {
    setRoomKeysStatus(
      'Room key import completed but recovered 0 sessions. Verify you selected the correct export file/passphrase for the device that can still decrypt your older messages.',
    );
    return;
  }

  setRoomKeysStatus(
    `Imported ${result.imported}/${result.total} room keys${result.failures > 0 ? ` with ${result.failures} failures` : ''} and requested timeline refresh.`,
  );
}

export async function exportRoomKeysToDownload({
  draft,
  onExportRoomKeys,
  setRoomKeysStatus,
}: ExportRoomKeysArgs): Promise<void> {
  setRoomKeysStatus('');

  const exported = await onExportRoomKeys(draft);
  const blob = new Blob([exported], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `sinnamon-room-keys-${Date.now()}.txt`;
  anchor.click();
  URL.revokeObjectURL(url);

  setRoomKeysStatus('Exported current room keys file for this device.');
}
