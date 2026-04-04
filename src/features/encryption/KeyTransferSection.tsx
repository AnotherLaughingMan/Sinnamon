import { useState } from 'react';
import { Key } from 'lucide-react';
import { Tooltip } from '../../components/Tooltip';
import type { MatrixConfig } from '../../matrix/types';
import type { RoomKeyImportProgress, RoomKeyImportResult } from '../../matrix/matrixCryptoService';
import {
  exportRoomKeysToDownload,
  importRoomKeysWithStatus,
} from './roomKeyTransfer';

type KeyTransferSectionProps = {
  draft: MatrixConfig;
  onImportRoomKeys: (
    value: MatrixConfig,
    exportedKeysJson: string,
    importPassphrase?: string,
    onProgress?: (progress: RoomKeyImportProgress) => void,
  ) => Promise<RoomKeyImportResult>;
  onExportRoomKeys: (value: MatrixConfig) => Promise<string>;
  onConnect: (value: MatrixConfig) => void | Promise<void>;
};

export function KeyTransferSection({
  draft,
  onImportRoomKeys,
  onExportRoomKeys,
  onConnect,
}: KeyTransferSectionProps) {
  const [roomKeysJson, setRoomKeysJson] = useState('');
  const [roomKeysPassphrase, setRoomKeysPassphrase] = useState('');
  const [roomKeysFileName, setRoomKeysFileName] = useState('');
  const [roomKeysStatus, setRoomKeysStatus] = useState('');
  const [isImportingRoomKeys, setIsImportingRoomKeys] = useState(false);
  const [isExportingRoomKeys, setIsExportingRoomKeys] = useState(false);

  return (
    <section>
      <h4>Imported Room Keys</h4>
      <label>
        Exported room keys (.txt or .json)
        <textarea
          className="settings-textarea"
          value={roomKeysJson}
          onChange={(event) => setRoomKeysJson(event.target.value)}
          placeholder="Paste exported room keys content here or load a .txt/.json file below."
          rows={8}
        />
      </label>

      <label>
        Export passphrase (only for passphrase-protected exports)
        <input
          value={roomKeysPassphrase}
          onChange={(event) => setRoomKeysPassphrase(event.target.value)}
          placeholder="Leave blank for unencrypted room-key exports"
          type="password"
        />
      </label>

      <label>
        Load exported room keys file (.txt or .json)
        <input
          accept=".json,.txt,application/json,text/plain"
          type="file"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) {
              return;
            }

            const text = await file.text();
            setRoomKeysJson(text);
            setRoomKeysFileName(file.name);
            setRoomKeysStatus(`Loaded ${file.name}.`);
          }}
        />
      </label>

      {roomKeysFileName && (
        <p className="settings-note">Current file: {roomKeysFileName}</p>
      )}

      {roomKeysStatus && (
        <p className="settings-note" aria-live="polite">
          {roomKeysStatus}
        </p>
      )}

      <div className="settings-actions-row settings-actions-row--inline">
        <Tooltip label="Import Element-compatible exported room keys into this device session">
          <button
            className="settings-btn"
            onClick={async () => {
              setIsImportingRoomKeys(true);

              try {
                await importRoomKeysWithStatus({
                  draft,
                  roomKeysJson,
                  roomKeysPassphrase,
                  onImportRoomKeys,
                  onConnect,
                  setRoomKeysStatus,
                });
              } catch (error) {
                setRoomKeysStatus(
                  error instanceof Error ? error.message : 'Room key import failed.',
                );
              } finally {
                setIsImportingRoomKeys(false);
              }
            }}
            disabled={isImportingRoomKeys}
          >
            {isImportingRoomKeys ? 'Importing…' : 'Import Exported Keys'}
          </button>
        </Tooltip>

        <Tooltip label="Export current device room keys as JSON for backup or migration">
          <button
            className="settings-btn settings-btn--secondary"
            onClick={async () => {
              setIsExportingRoomKeys(true);

              try {
                await exportRoomKeysToDownload({
                  draft,
                  onExportRoomKeys,
                  setRoomKeysStatus,
                });
              } catch (error) {
                setRoomKeysStatus(
                  error instanceof Error ? error.message : 'Room key export failed.',
                );
              } finally {
                setIsExportingRoomKeys(false);
              }
            }}
            disabled={isExportingRoomKeys}
          >
            {isExportingRoomKeys ? 'Exporting…' : 'Export Current Keys'}
          </button>
        </Tooltip>
      </div>

      <p className="settings-note">
        This uses the Matrix exported-room-keys JSON format used by Element and compatible Matrix clients.
      </p>
    </section>
  );
}
