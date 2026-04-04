import { useCallback, useEffect, useState } from 'react';
import { bootstrapCrossSigning } from '../../matrix/matrixCryptoService';
import type { MatrixConfig } from '../../matrix/types';

type Phase = 'setting_up' | 'error' | 'done';

type InitialE2ESetupViewProps = {
  config: MatrixConfig;
  onFinished: () => void;
  onCancelled: () => void;
};

/**
 * Mirrors element-web-ex E2eSetup / InitialCryptoSetupDialog.
 * Bootstraps cross-signing keys on first login.
 * Shows a spinner during setup; error + retry/cancel on failure.
 */
export function InitialE2ESetupView({ config, onFinished, onCancelled }: InitialE2ESetupViewProps) {
  const [phase, setPhase] = useState<Phase>('setting_up');
  const [errorMessage, setErrorMessage] = useState('');

  const runBootstrap = useCallback(async () => {
    setPhase('setting_up');
    setErrorMessage('');
    try {
      await bootstrapCrossSigning(config);
      setPhase('done');
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to set up encryption keys.',
      );
      setPhase('error');
    }
  }, [config]);

  useEffect(() => {
    void runBootstrap();
  }, [runBootstrap]);

  useEffect(() => {
    if (phase === 'done') {
      onFinished();
    }
  }, [phase, onFinished]);

  return (
    <div className="e2ee-gate-overlay" role="dialog" aria-modal="true" aria-label="Set up encryption">
      <div className="e2ee-gate-card">
        <h2 className="e2ee-gate-title">Setting up encryption</h2>

        {phase === 'setting_up' && (
          <>
            <p className="e2ee-gate-description">
              Creating your cross-signing keys. This happens once per account and only takes a moment.
            </p>
            <div className="e2ee-gate-spinner" aria-label="Setting up encryption…" />
          </>
        )}

        {phase === 'error' && (
          <>
            <p className="e2ee-gate-description e2ee-gate-description--error">
              Unable to set up encryption keys.
            </p>
            {errorMessage && (
              <p className="e2ee-gate-detail">{errorMessage}</p>
            )}
            <div className="e2ee-gate-actions">
              <button className="e2ee-gate-btn e2ee-gate-btn--primary" onClick={runBootstrap}>
                Retry
              </button>
              <button className="e2ee-gate-btn e2ee-gate-btn--secondary" onClick={onCancelled}>
                Skip for now
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
