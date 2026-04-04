import { useEffect, useMemo, useState } from 'react';
import type { MatrixConfig, MatrixKeyBackupInfo } from '../../matrix/types';
import type {
  CryptoSessionStatus,
  DeviceVerificationEntry,
  KeyBackupRestoreResult,
  RoomKeyImportProgress,
  VerificationSasData,
  VerificationSessionStatus,
  VerificationSummary,
} from '../../matrix/matrixCryptoService';
import { KeyStoragePanel } from './KeyStoragePanel';
import { RecoveryPanel, type MissingKeyRecoveryOutcome } from './RecoveryPanel';
import { AdvancedPanel } from './AdvancedPanel';
import { ChangeRecoveryKeyPanel } from './ChangeRecoveryKeyPanel';
import { DeleteKeyStoragePanel } from './DeleteKeyStoragePanel';

export type EncryptionSettingsState =
  | 'main'
  | 'change_recovery_key'
  | 'set_recovery_key'
  | 'reset_identity_compromised'
  | 'reset_identity_forgot'
  | 'reset_identity_sync_failed'
  | 'reset_identity_cant_recover'
  | 'key_storage_delete';

type DeviceState = 'verify_this_session' | 'key_storage_out_of_sync' | 'identity_needs_reset' | 'ready';

type EncryptionSettingsTabProps = {
  draft: MatrixConfig;
  initialUserId: string;
  selectedRoomUndecryptableCount: number;
  onConnect: (value: MatrixConfig) => void | Promise<void>;
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
  onGetVerificationSummary: (
    value: MatrixConfig,
    targetUserId: string,
    verificationRoomId?: string,
  ) => Promise<VerificationSummary>;
  onRequestVerificationDm: (
    value: MatrixConfig,
    targetUserId: string,
    roomId: string,
  ) => Promise<VerificationSessionStatus>;
  onAcceptVerificationDmRequest: (
    value: MatrixConfig,
    targetUserId: string,
    roomId: string,
  ) => Promise<VerificationSessionStatus>;
  onCancelVerificationDmRequest: (
    value: MatrixConfig,
    targetUserId: string,
    roomId: string,
  ) => Promise<VerificationSessionStatus>;
  onStartOrContinueSasVerification: (
    value: MatrixConfig,
    targetUserId: string,
    roomId: string,
  ) => Promise<VerificationSasData>;
  onConfirmSasVerification: (
    value: MatrixConfig,
    targetUserId: string,
    roomId: string,
  ) => Promise<VerificationSessionStatus>;
  onMismatchSasVerification: (
    value: MatrixConfig,
    targetUserId: string,
    roomId: string,
  ) => Promise<VerificationSessionStatus>;
  onListUserDeviceVerification: (
    value: MatrixConfig,
    targetUserId: string,
  ) => Promise<DeviceVerificationEntry[]>;
  onSetDeviceLocalVerification: (
    value: MatrixConfig,
    targetUserId: string,
    deviceId: string,
    verified?: boolean,
  ) => Promise<DeviceVerificationEntry>;
  onCrossSignOwnDevice: (value: MatrixConfig, deviceId?: string) => Promise<string>;
  onResetKeyBackup: (value: MatrixConfig) => Promise<void>;
  onDisableKeyStorage: (value: MatrixConfig) => Promise<void>;
};

export function EncryptionSettingsTab({
  draft,
  initialUserId,
  selectedRoomUndecryptableCount,
  onConnect,
  onCheckKeyBackup,
  onGetCryptoSessionStatus,
  onRecoverMissingKeys,
  onRestoreKeyBackupWithRecoveryKey,
  onRestoreKeyBackupWithPassphrase,
  onGetVerificationSummary,
  onRequestVerificationDm,
  onAcceptVerificationDmRequest,
  onCancelVerificationDmRequest,
  onStartOrContinueSasVerification,
  onConfirmSasVerification,
  onMismatchSasVerification,
  onListUserDeviceVerification,
  onSetDeviceLocalVerification,
  onCrossSignOwnDevice,
  onResetKeyBackup,
  onDisableKeyStorage,
}: EncryptionSettingsTabProps) {
  const [state, setState] = useState<EncryptionSettingsState>('main');
  const [deviceState, setDeviceState] = useState<DeviceState>('ready');
  const [isLoadingDeviceState, setIsLoadingDeviceState] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    setIsLoadingDeviceState(true);

    Promise.all([
      onGetCryptoSessionStatus(draft),
      onGetVerificationSummary(draft, draft.userId || initialUserId),
    ])
      .then(([cryptoStatus, ownSummary]) => {
        if (cancelled) {
          return;
        }

        if (ownSummary.needsUserApproval) {
          setDeviceState('identity_needs_reset');
          return;
        }

        if (!ownSummary.isCrossSigningVerified) {
          setDeviceState('verify_this_session');
          return;
        }

        if (cryptoStatus.activeBackupVersion && !cryptoStatus.hasSessionBackupPrivateKey) {
          setDeviceState('key_storage_out_of_sync');
          return;
        }

        setDeviceState('ready');
      })
      .catch(() => {
        if (!cancelled) {
          setDeviceState('ready');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingDeviceState(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [draft, initialUserId, onGetCryptoSessionStatus, onGetVerificationSummary]);

  const showMain = useMemo(() => state === 'main', [state]);

  if (isLoadingDeviceState && showMain) {
    return (
      <section>
        <h4>Encryption</h4>
        <p className="settings-note">Loading encryption state…</p>
      </section>
    );
  }

  if (state === 'change_recovery_key' || state === 'set_recovery_key') {
    return (
      <ChangeRecoveryKeyPanel
        userHasRecoveryKey={state === 'change_recovery_key'}
        onResetKeyBackup={() => onResetKeyBackup(draft)}
        onCancelClick={() => setState('main')}
        onFinish={() => setState('main')}
      />
    );
  }

  if (state === 'key_storage_delete') {
    return (
      <DeleteKeyStoragePanel
        onDisableKeyStorage={() => onDisableKeyStorage(draft)}
        onFinish={() => setState('main')}
        onCancel={() => setState('main')}
      />
    );
  }

  if (
    state === 'reset_identity_compromised'
    || state === 'reset_identity_forgot'
    || state === 'reset_identity_sync_failed'
    || state === 'reset_identity_cant_recover'
  ) {
    return (
      <section>
        <h4>Reset Identity</h4>
        <p className="settings-note settings-note--warn">
          {state === 'reset_identity_compromised' && 'Your encryption identity may be compromised. Reset and re-verify this session.'}
          {state === 'reset_identity_forgot' && 'You no longer have the recovery key. Reset identity and establish a new trusted chain.'}
          {state === 'reset_identity_sync_failed' && 'Recovery sync failed. Reset identity and bootstrap trust from this session.'}
          {state === 'reset_identity_cant_recover' && 'Recovery cannot proceed. Reset identity and re-verify with another trusted device.'}
        </p>

        {statusMessage && <p className="settings-note">{statusMessage}</p>}

        <div className="settings-actions-row settings-actions-row--inline">
          <button
            className="settings-btn"
            onClick={async () => {
              setStatusMessage('Re-signing this device…');
              try {
                await onCrossSignOwnDevice(draft, draft.deviceId);
                setStatusMessage('Identity reset flow complete for this device.');
                setState('main');
              } catch (error) {
                setStatusMessage(error instanceof Error ? error.message : 'Unable to complete identity reset.');
              }
            }}
          >
            Continue Reset
          </button>
          <button className="settings-btn settings-btn--secondary" onClick={() => setState('main')}>
            Cancel
          </button>
        </div>
      </section>
    );
  }

  if (deviceState === 'verify_this_session') {
    return (
      <section>
        <h4>Verify This Session</h4>
        <p className="settings-note settings-note--warn">
          This device is not yet verified. Complete verification before relying on encrypted message recovery.
        </p>
        <button className="settings-btn" onClick={() => setState('reset_identity_compromised')}>
          Start Verification Flow
        </button>
      </section>
    );
  }

  if (deviceState === 'key_storage_out_of_sync') {
    return (
      <section>
        <h4>Recovery Out of Sync</h4>
        <p className="settings-note settings-note--warn">
          This session can see backup metadata, but does not currently have the corresponding local recovery key.
        </p>
        <div className="settings-actions-row settings-actions-row--inline">
          <button className="settings-btn" onClick={() => setState('change_recovery_key')}>
            Restore Access
          </button>
          <button className="settings-btn settings-btn--secondary" onClick={() => setState('reset_identity_forgot')}>
            I Forgot Recovery Key
          </button>
        </div>
      </section>
    );
  }

  if (deviceState === 'identity_needs_reset') {
    return (
      <section>
        <h4>Identity Needs Reset</h4>
        <p className="settings-note settings-note--warn">
          Encryption identity requires reset before secure backup operations can continue.
        </p>
        <button className="settings-btn" onClick={() => setState('reset_identity_cant_recover')}>
          Continue
        </button>
      </section>
    );
  }

  return (
    <>
      <KeyStoragePanel
        draft={draft}
        onGetCryptoSessionStatus={onGetCryptoSessionStatus}
        onVerifyThisSession={() => setState('reset_identity_compromised')}
        onKeyStorageDisableClick={() => setState('key_storage_delete')}
      />

      <RecoveryPanel
        draft={draft}
        selectedRoomUndecryptableCount={selectedRoomUndecryptableCount}
        onCheckKeyBackup={onCheckKeyBackup}
        onGetCryptoSessionStatus={onGetCryptoSessionStatus}
        onRecoverMissingKeys={onRecoverMissingKeys}
        onRestoreKeyBackupWithRecoveryKey={onRestoreKeyBackupWithRecoveryKey}
        onRestoreKeyBackupWithPassphrase={onRestoreKeyBackupWithPassphrase}
        onConnect={onConnect}
        onChangeRecoveryKeyClick={(setupNewKey) => setState(setupNewKey ? 'set_recovery_key' : 'change_recovery_key')}
      />

      <AdvancedPanel
        draft={draft}
        initialUserId={initialUserId}
        onGetVerificationSummary={onGetVerificationSummary}
        onRequestVerificationDm={onRequestVerificationDm}
        onAcceptVerificationDmRequest={onAcceptVerificationDmRequest}
        onCancelVerificationDmRequest={onCancelVerificationDmRequest}
        onStartOrContinueSasVerification={onStartOrContinueSasVerification}
        onConfirmSasVerification={onConfirmSasVerification}
        onMismatchSasVerification={onMismatchSasVerification}
        onListUserDeviceVerification={onListUserDeviceVerification}
        onSetDeviceLocalVerification={onSetDeviceLocalVerification}
        onCrossSignOwnDevice={onCrossSignOwnDevice}
        onResetIdentityClick={() => setState('reset_identity_compromised')}
      />
    </>
  );
}
