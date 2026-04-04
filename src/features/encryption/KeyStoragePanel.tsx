import { useState } from 'react';
import { Tooltip } from '../../components/Tooltip';
import type { MatrixConfig } from '../../matrix/types';
import type { CryptoSessionStatus } from '../../matrix/matrixCryptoService';

type KeyStoragePanelProps = {
  draft: MatrixConfig;
  onGetCryptoSessionStatus: (value: MatrixConfig) => Promise<CryptoSessionStatus>;
  onVerifyThisSession: () => void;
  onKeyStorageDisableClick: () => void;
};

export function KeyStoragePanel({
  draft,
  onGetCryptoSessionStatus,
  onVerifyThisSession,
  onKeyStorageDisableClick,
}: KeyStoragePanelProps) {
  const [statusMessage, setStatusMessage] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  return (
    <section>
      <h4>Key Storage</h4>
      <p className="settings-note">
        Key storage keeps your encryption recovery data available across devices.
      </p>

      {statusMessage && (
        <p className="settings-note" aria-live="polite">
          {statusMessage}
        </p>
      )}

      <div className="settings-actions-row settings-actions-row--inline">
        <Tooltip label="Inspect key storage and backup readiness">
          <button
            className="settings-btn settings-btn--secondary"
            onClick={async () => {
              setIsRefreshing(true);
              setStatusMessage('Refreshing key storage status…');
              try {
                const status = await onGetCryptoSessionStatus(draft);
                const backupVersion = status.activeBackupVersion
                  ? `active backup version ${status.activeBackupVersion}`
                  : 'no active backup version';
                setStatusMessage(
                  `Device binding ${status.hasDeviceBinding ? 'ready' : 'missing'}; local backup key ${status.hasSessionBackupPrivateKey ? 'present' : 'missing'}; secret storage key ${status.keyStoredInSecretStorage ? 'present' : 'missing'}; ${backupVersion}.`,
                );
              } catch (error) {
                setStatusMessage(error instanceof Error ? error.message : 'Unable to refresh key storage status.');
              } finally {
                setIsRefreshing(false);
              }
            }}
            disabled={isRefreshing}
          >
            {isRefreshing ? 'Refreshing…' : 'Refresh Key Storage Status'}
          </button>
        </Tooltip>

        <Tooltip label="Run device verification flow for this session">
          <button className="settings-btn" onClick={onVerifyThisSession}>
            Verify This Session
          </button>
        </Tooltip>

        <Tooltip label="Disable key storage and remove backup secrets from this account/session">
          <button className="settings-btn settings-btn--secondary" onClick={onKeyStorageDisableClick}>
            Turn Off Key Storage
          </button>
        </Tooltip>
      </div>
    </section>
  );
}
