import { useState } from 'react';
import { restoreKeyBackupWithRecoveryKey } from '../../matrix/matrixCryptoService';
import type { RoomKeyImportProgress } from '../../matrix/matrixCryptoService';
import type { MatrixConfig } from '../../matrix/types';

type Phase = 'intro' | 'busy' | 'recovery' | 'done' | 'verify_other_device' | 'confirm_skip';

type CompleteSecurityViewProps = {
  config: MatrixConfig;
  hasBackupAvailable: boolean;
  onVerifyFromAnotherDevice: () => Promise<void>;
  onFinished: () => void;
  onSignOut: () => void;
};

/**
 * Mirrors element-web-ex SetupEncryptionBody.
 * Shown when cross-signing keys already exist (existing session needs to be verified).
 * Options: verify with another device, use recovery key, can't confirm, sign out.
 */
export function CompleteSecurityView({
  config,
  hasBackupAvailable,
  onVerifyFromAnotherDevice,
  onFinished,
  onSignOut,
}: CompleteSecurityViewProps) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [recoveryStatus, setRecoveryStatus] = useState('');

  const handleUseRecoveryKey = async () => {
    const trimmedKey = recoveryKey.trim();
    if (!trimmedKey) {
      setRecoveryError('Enter your recovery key.');
      return;
    }
    setPhase('busy');
    setRecoveryError('');
    setRecoveryStatus('Restoring from key backup…');

    try {
      const onProgress = (progress: RoomKeyImportProgress) => {
        setRecoveryStatus(
          `Importing keys: ${progress.successes}/${progress.total}…`,
        );
      };
      await restoreKeyBackupWithRecoveryKey(config, trimmedKey, onProgress);
      setPhase('done');
    } catch (error) {
      setRecoveryError(
        error instanceof Error ? error.message : 'Recovery key restore failed.',
      );
      setPhase('recovery');
    }
  };

  const handleVerifyFromAnotherDevice = async () => {
    setRecoveryError('');
    setRecoveryStatus('Opening verification request for another logged-in device...');
    setPhase('busy');

    try {
      await onVerifyFromAnotherDevice();
      setPhase('verify_other_device');
    } catch (error) {
      setRecoveryError(
        error instanceof Error ? error.message : 'Unable to start verification from another device.',
      );
      setPhase('intro');
    }
  };

  if (phase === 'busy') {
    return (
      <div className="e2ee-gate-overlay">
        <div className="e2ee-gate-card">
          <h2 className="e2ee-gate-title">Verifying…</h2>
          <p className="e2ee-gate-description">{recoveryStatus || 'Please wait…'}</p>
          <div className="e2ee-gate-spinner" aria-label="Working…" />
        </div>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="e2ee-gate-overlay" role="dialog" aria-modal="true" aria-label="Encryption verified">
        <div className="e2ee-gate-card">
          <h2 className="e2ee-gate-title">Encryption ready</h2>
          <p className="e2ee-gate-description">
            Your session is verified and your encrypted message history is available.
          </p>
          <div className="e2ee-gate-actions">
            <button className="e2ee-gate-btn e2ee-gate-btn--primary" onClick={onFinished}>
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'confirm_skip') {
    return (
      <div className="e2ee-gate-overlay" role="dialog" aria-modal="true" aria-label="Skip verification">
        <div className="e2ee-gate-card">
          <h2 className="e2ee-gate-title">Skip verification?</h2>
          <p className="e2ee-gate-description">
            Skipping verification means this device will not be trusted by your other devices and you
            may not be able to read encrypted messages.
          </p>
          <div className="e2ee-gate-actions">
            <button className="e2ee-gate-btn e2ee-gate-btn--danger" onClick={onFinished}>
              Skip for now
            </button>
            <button
              className="e2ee-gate-btn e2ee-gate-btn--secondary"
              onClick={() => setPhase('intro')}
            >
              Go back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'verify_other_device') {
    return (
      <div className="e2ee-gate-overlay" role="dialog" aria-modal="true" aria-label="Verify from another device">
        <div className="e2ee-gate-card">
          <h2 className="e2ee-gate-title">Verify from another device</h2>
          <p className="e2ee-gate-description">
            We sent a verification request to your other signed-in devices. Open Element or another
            Matrix client on a trusted device and complete the verification there.
          </p>
          <div className="e2ee-gate-actions">
            <button className="e2ee-gate-btn e2ee-gate-btn--primary" onClick={onFinished}>
              I have verified this session
            </button>
            <button className="e2ee-gate-btn e2ee-gate-btn--secondary" onClick={() => setPhase('intro')}>
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'recovery') {
    return (
      <div className="e2ee-gate-overlay" role="dialog" aria-modal="true" aria-label="Use recovery key">
        <div className="e2ee-gate-card">
          <h2 className="e2ee-gate-title">Use recovery key</h2>
          <p className="e2ee-gate-description">
            Enter the recovery key you saved when you first set up encryption to restore access to
            your encrypted message history.
          </p>
          <label className="e2ee-gate-field-label">
            Recovery key
            <input
              className="e2ee-gate-input"
              value={recoveryKey}
              onChange={(e) => setRecoveryKey(e.target.value)}
              placeholder="EsA0 mRGF … (your 56-character recovery key)"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          {recoveryError && (
            <p className="e2ee-gate-description e2ee-gate-description--error">{recoveryError}</p>
          )}
          <div className="e2ee-gate-actions">
            <button
              className="e2ee-gate-btn e2ee-gate-btn--primary"
              onClick={handleUseRecoveryKey}
              disabled={!recoveryKey.trim()}
            >
              Continue
            </button>
            <button
              className="e2ee-gate-btn e2ee-gate-btn--secondary"
              onClick={() => { setPhase('intro'); setRecoveryError(''); }}
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // phase === 'intro'
  return (
    <div className="e2ee-gate-overlay" role="dialog" aria-modal="true" aria-label="Verify this session">
      <div className="e2ee-gate-card">
        <h2 className="e2ee-gate-title">Verify this session</h2>
        <p className="e2ee-gate-description">
          Confirm your identity to access your encrypted messages. Use another logged-in device or
          your recovery key.
        </p>

        <div className="e2ee-gate-actions">
          <button
            className="e2ee-gate-btn e2ee-gate-btn--primary"
            onClick={handleVerifyFromAnotherDevice}
          >
            Verify from another device
          </button>

          {hasBackupAvailable && (
            <button
              className="e2ee-gate-btn e2ee-gate-btn--secondary"
              onClick={() => setPhase('recovery')}
            >
              Use recovery key
            </button>
          )}

          {recoveryError && (
            <p className="e2ee-gate-description e2ee-gate-description--error">{recoveryError}</p>
          )}

          <button
            className="e2ee-gate-btn e2ee-gate-btn--secondary"
            onClick={() => setPhase('confirm_skip')}
          >
            Can&apos;t confirm
          </button>

          <button className="e2ee-gate-btn e2ee-gate-btn--tertiary" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
