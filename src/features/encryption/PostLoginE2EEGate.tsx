import { useEffect, useState } from 'react';
import { checkCrossSigningStatus } from '../../matrix/matrixCryptoService';
import type { CrossSigningStatus } from '../../matrix/matrixCryptoService';
import type { MatrixConfig } from '../../matrix/types';
import { CompleteSecurityView } from './CompleteSecurityView';
import { InitialE2ESetupView } from './InitialE2ESetupView';

type GatePhase =
  | 'checking'
  | 'show_complete_security'
  | 'show_initial_setup'
  | 'finished';

type PostLoginE2EEGateProps = {
  config: MatrixConfig;
  onFinished: () => void;
  onVerifyFromAnotherDevice: () => Promise<void>;
  onSignOut: () => void;
};

/**
 * Shown after connectionState becomes 'connected'.
 * Checks cross-signing status and routes to the appropriate view:
 *  - has cross-signing keys → CompleteSecurityView (verify this session)
 *  - no cross-signing keys  → InitialE2ESetupView (set up encryption)
 *  - no crypto              → calls onFinished() immediately
 */
export function PostLoginE2EEGate({
  config,
  onFinished,
  onVerifyFromAnotherDevice,
  onSignOut,
}: PostLoginE2EEGateProps) {
  const [phase, setPhase] = useState<GatePhase>('checking');
  const [crossSigningStatus, setCrossSigningStatus] = useState<CrossSigningStatus | null>(null);

  useEffect(() => {
    let cancelled = false;

    checkCrossSigningStatus(config).then((status) => {
      if (cancelled) return;

      setCrossSigningStatus(status);

      if (!status.cryptoAvailable) {
        // No crypto: skip gate entirely
        setPhase('finished');
        return;
      }

      if (status.hasCrossSigningKeys) {
        setPhase('show_complete_security');
      } else {
        setPhase('show_initial_setup');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [config]);

  useEffect(() => {
    if (phase === 'finished') {
      onFinished();
    }
  }, [phase, onFinished]);

  if (phase === 'checking') {
    return (
      <div className="e2ee-gate-overlay" aria-label="Checking encryption status">
        <div className="e2ee-gate-card">
          <h2 className="e2ee-gate-title">Checking encryption</h2>
          <p className="e2ee-gate-description">Checking your encryption status…</p>
          <div className="e2ee-gate-spinner" aria-label="Loading…" />
        </div>
      </div>
    );
  }

  if (phase === 'show_complete_security' && crossSigningStatus) {
    return (
      <CompleteSecurityView
        config={config}
        hasBackupAvailable={crossSigningStatus.hasBackupAvailable}
        onVerifyFromAnotherDevice={onVerifyFromAnotherDevice}
        onFinished={() => setPhase('finished')}
        onSignOut={onSignOut}
      />
    );
  }

  if (phase === 'show_initial_setup') {
    return (
      <InitialE2ESetupView
        config={config}
        onFinished={() => setPhase('finished')}
        onCancelled={() => setPhase('finished')}
      />
    );
  }

  // phase === 'finished' — parent will unmount us
  return null;
}
