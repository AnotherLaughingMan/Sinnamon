import { useEffect, useMemo, useState } from 'react';
import { Tooltip } from '../../components/Tooltip';
import type { MatrixConfig, MatrixKeyBackupInfo } from '../../matrix/types';
import type {
  CryptoSessionStatus,
  KeyBackupRestoreResult,
  MissingKeysRecoveryResult,
  RoomKeyImportProgress,
} from '../../matrix/matrixCryptoService';

export type MissingKeyRecoveryOutcome = {
  targetRoomId: string;
  undecryptableBefore: number;
  undecryptableAfter: number;
  backup: MissingKeysRecoveryResult;
  backupError?: string;
};

type RecoveryPanelProps = {
  draft: MatrixConfig;
  selectedRoomUndecryptableCount: number;
  onCheckKeyBackup: (value: MatrixConfig) => Promise<MatrixKeyBackupInfo | null>;
  onGetCryptoSessionStatus: (value: MatrixConfig) => Promise<CryptoSessionStatus>;
  onRecoverMissingKeys: () => Promise<MissingKeyRecoveryOutcome>;
  onRestoreKeyBackupWithRecoveryKey: (
    value: MatrixConfig,
    recoveryKey: string,
    onProgress?: (progress: RoomKeyImportProgress) => void,
  ) => Promise<KeyBackupRestoreResult>;
  onRestoreKeyBackupWithPassphrase: (
    value: MatrixConfig,
    passphrase: string,
    onProgress?: (progress: RoomKeyImportProgress) => void,
  ) => Promise<KeyBackupRestoreResult>;
  onConnect: (value: MatrixConfig) => void | Promise<void>;
  onChangeRecoveryKeyClick: (setupNewKey: boolean) => void;
};

export function RecoveryPanel({
  draft,
  selectedRoomUndecryptableCount,
  onCheckKeyBackup,
  onGetCryptoSessionStatus,
  onRecoverMissingKeys,
  onRestoreKeyBackupWithRecoveryKey,
  onRestoreKeyBackupWithPassphrase,
  onConnect,
  onChangeRecoveryKeyClick,
}: RecoveryPanelProps) {
  const [keyBackupStatus, setKeyBackupStatus] = useState('');
  const [isCheckingKeyBackup, setIsCheckingKeyBackup] = useState(false);
  const [backupRecoveryKey, setBackupRecoveryKey] = useState('');
  const [backupPassphrase, setBackupPassphrase] = useState('');
  const [restoreBackupStatus, setRestoreBackupStatus] = useState('');
  const [isRestoringBackupWithRecoveryKey, setIsRestoringBackupWithRecoveryKey] = useState(false);
  const [isRestoringBackupWithPassphrase, setIsRestoringBackupWithPassphrase] = useState(false);
  const [cryptoSessionStatus, setCryptoSessionStatus] = useState('');
  const [isRefreshingCryptoStatus, setIsRefreshingCryptoStatus] = useState(false);
  const [missingKeysStatus, setMissingKeysStatus] = useState('');
  const [isRecoveringMissingKeys, setIsRecoveringMissingKeys] = useState(false);

  const hasStoredSession = Boolean(draft.accessToken.trim() && draft.userId.trim());

  const keyBackupSummary = useMemo(() => {
    if (!keyBackupStatus) {
      return 'Check whether this account has a server-side key backup configured.';
    }

    return keyBackupStatus;
  }, [keyBackupStatus]);

  useEffect(() => {
    setKeyBackupStatus('');
    setBackupRecoveryKey('');
    setBackupPassphrase('');
    setRestoreBackupStatus('');
    setCryptoSessionStatus('');
    setMissingKeysStatus('');
  }, [draft.accessToken, draft.userId, draft.deviceId]);

  return (
    <section>
      <h4>Recovery</h4>
      <p className="settings-note">{keyBackupSummary}</p>
      <div className="settings-actions-row">
        <Tooltip label="Check if this account has server-side backup metadata">
          <button
            className="settings-btn settings-btn--secondary"
            onClick={async () => {
              if (!hasStoredSession) {
                setKeyBackupStatus('Log in or paste an access token before checking key backup status.');
                return;
              }

              setIsCheckingKeyBackup(true);
              try {
                const backup = await onCheckKeyBackup(draft);
                if (!backup) {
                  setKeyBackupStatus('No server-side key backup is configured for this account yet.');
                  return;
                }

                const sessionCount = typeof backup.count === 'number'
                  ? `, ${backup.count} backed up session${backup.count === 1 ? '' : 's'}`
                  : '';
                setKeyBackupStatus(
                  `Backup version ${backup.version} using ${backup.algorithm}${sessionCount}.`,
                );
              } catch (error) {
                setKeyBackupStatus(
                  error instanceof Error ? error.message : 'Unable to query Matrix key backup status.',
                );
              } finally {
                setIsCheckingKeyBackup(false);
              }
            }}
            disabled={isCheckingKeyBackup}
          >
            {isCheckingKeyBackup ? 'Checking…' : 'Check Server Key Backup'}
          </button>
        </Tooltip>

        <Tooltip label="Inspect whether this session already has usable local backup keys">
          <button
            className="settings-btn settings-btn--secondary"
            onClick={async () => {
              setIsRefreshingCryptoStatus(true);
              setCryptoSessionStatus('');

              try {
                const status = await onGetCryptoSessionStatus(draft);
                const backupVersionSummary = status.activeBackupVersion
                  ? `active backup version ${status.activeBackupVersion}`
                  : 'no active backup version';

                setCryptoSessionStatus(
                  `Device binding ${status.hasDeviceBinding ? 'ready' : 'missing'}; local backup key ${status.hasSessionBackupPrivateKey ? 'present' : 'missing'}; secret storage key ${status.keyStoredInSecretStorage ? 'available' : 'missing'}; ${backupVersionSummary}.`,
                );
              } catch (error) {
                setCryptoSessionStatus(
                  error instanceof Error ? error.message : 'Unable to determine crypto session status.',
                );
              } finally {
                setIsRefreshingCryptoStatus(false);
              }
            }}
            disabled={isRefreshingCryptoStatus}
          >
            {isRefreshingCryptoStatus ? 'Refreshing…' : 'Refresh Crypto Session Status'}
          </button>
        </Tooltip>
      </div>

      <div className="settings-actions-row settings-actions-row--inline">
        <button
          className="settings-btn settings-btn--secondary"
          onClick={() => onChangeRecoveryKeyClick(false)}
        >
          Change Recovery Key
        </button>
        <button
          className="settings-btn settings-btn--secondary"
          onClick={() => onChangeRecoveryKeyClick(true)}
        >
          Set Up Recovery Key
        </button>
      </div>

      {cryptoSessionStatus && (
        <p className="settings-note" aria-live="polite">
          {cryptoSessionStatus}
        </p>
      )}

      <p className="settings-note" aria-live="polite">
        Current room undecryptable messages: {selectedRoomUndecryptableCount}
      </p>

      {missingKeysStatus && (
        <p className="settings-note" aria-live="polite">
          {missingKeysStatus}
        </p>
      )}

      <div className="settings-actions-row">
        <Tooltip label="Retry undecryptable events by restoring available backup keys and resyncing the current room timeline">
          <button
            className="settings-btn"
            onClick={async () => {
              setIsRecoveringMissingKeys(true);
              setMissingKeysStatus('Recovering missing keys for current room...');

              try {
                const outcome = await onRecoverMissingKeys();
                const backupSummary = outcome.backup.attemptedBackupRestore
                  ? `backup restored ${outcome.backup.importedFromBackup}/${outcome.backup.totalFromBackup} keys`
                  : outcome.backup.backupAvailable
                    ? 'backup key is missing in this session, so backup restore was skipped'
                    : 'no server backup is configured';

                const backupErrorSummary = outcome.backupError
                  ? ` Backup: ${outcome.backupError} If exported room-key import reduced undecryptable messages, that import remains the source of truth for those sessions.`
                  : '';
                setMissingKeysStatus(
                  `Room ${outcome.targetRoomId}: undecryptable messages ${outcome.undecryptableBefore} -> ${outcome.undecryptableAfter}; ${backupSummary}.${backupErrorSummary}`,
                );
              } catch (error) {
                setMissingKeysStatus(
                  error instanceof Error ? error.message : 'Missing-key recovery failed.',
                );
              } finally {
                setIsRecoveringMissingKeys(false);
              }
            }}
            disabled={isRecoveringMissingKeys}
          >
            {isRecoveringMissingKeys ? 'Recovering…' : 'Recover Missing Keys (Current Room)'}
          </button>
        </Tooltip>
      </div>

      <label>
        Recovery Key
        <textarea
          className="settings-textarea"
          value={backupRecoveryKey}
          onChange={(event) => setBackupRecoveryKey(event.target.value)}
          placeholder="EsTc ... Matrix recovery key"
          rows={3}
        />
      </label>

      <label>
        Backup Passphrase
        <input
          value={backupPassphrase}
          onChange={(event) => setBackupPassphrase(event.target.value)}
          placeholder="Only for legacy passphrase-based backups"
          type="password"
        />
      </label>

      {restoreBackupStatus && (
        <p className="settings-note" aria-live="polite">
          {restoreBackupStatus}
        </p>
      )}

      <div className="settings-actions-row">
        <Tooltip label="Restore all possible room keys from server backup using recovery key">
          <button
            className="settings-btn"
            onClick={async () => {
              setIsRestoringBackupWithRecoveryKey(true);
              setRestoreBackupStatus('Starting backup restore...');

              try {
                const result = await onRestoreKeyBackupWithRecoveryKey(
                  draft,
                  backupRecoveryKey,
                  (progress) => {
                    setRestoreBackupStatus(
                      `Restoring backup keys: ${progress.successes}/${progress.total} loaded${progress.failures > 0 ? `, ${progress.failures} failed` : ''}.`,
                    );
                  },
                );

                await onConnect(draft);
                if (result.imported === 0) {
                  setRestoreBackupStatus(
                    'Backup restore completed but recovered 0 keys for this backup version. If backup was reset in Element, this recovery key may not match that version. Exported room keys from a device that could decrypt those messages can still recover history.',
                  );
                } else {
                  setRestoreBackupStatus(
                    `Restored ${result.imported}/${result.total} keys from the server backup and requested timeline refresh.`,
                  );
                }
              } catch (error) {
                setRestoreBackupStatus(
                  error instanceof Error ? error.message : 'Backup restore failed.',
                );
              } finally {
                setIsRestoringBackupWithRecoveryKey(false);
              }
            }}
            disabled={isRestoringBackupWithRecoveryKey}
          >
            {isRestoringBackupWithRecoveryKey ? 'Restoring…' : 'Restore With Recovery Key'}
          </button>
        </Tooltip>

        <Tooltip label="Legacy option for older passphrase-based backups">
          <button
            className="settings-btn settings-btn--secondary"
            onClick={async () => {
              setIsRestoringBackupWithPassphrase(true);
              setRestoreBackupStatus('Starting backup restore...');

              try {
                const result = await onRestoreKeyBackupWithPassphrase(
                  draft,
                  backupPassphrase,
                  (progress) => {
                    setRestoreBackupStatus(
                      `Restoring backup keys: ${progress.successes}/${progress.total} loaded${progress.failures > 0 ? `, ${progress.failures} failed` : ''}.`,
                    );
                  },
                );

                await onConnect(draft);
                if (result.imported === 0) {
                  setRestoreBackupStatus(
                    'Backup restore completed but recovered 0 keys for this backup version. If backup was reset in Element, this passphrase may not match that version. Exported room keys from a device that could decrypt those messages can still recover history.',
                  );
                } else {
                  setRestoreBackupStatus(
                    `Restored ${result.imported}/${result.total} keys from the server backup and requested timeline refresh.`,
                  );
                }
              } catch (error) {
                setRestoreBackupStatus(
                  error instanceof Error ? error.message : 'Backup restore failed.',
                );
              } finally {
                setIsRestoringBackupWithPassphrase(false);
              }
            }}
            disabled={isRestoringBackupWithPassphrase}
          >
            {isRestoringBackupWithPassphrase ? 'Restoring…' : 'Restore With Passphrase'}
          </button>
        </Tooltip>
      </div>

      <p className="settings-note">
        Use the Matrix recovery key when available. Passphrase restore is only for older backup setups.
      </p>
    </section>
  );
}
