import { useState } from 'react';
import { Tooltip } from '../../components/Tooltip';

type ChangeRecoveryKeyPanelProps = {
  userHasRecoveryKey: boolean;
  onResetKeyBackup: () => Promise<void>;
  onCancelClick: () => void;
  onFinish: () => void;
};

export function ChangeRecoveryKeyPanel({
  userHasRecoveryKey,
  onResetKeyBackup,
  onCancelClick,
  onFinish,
}: ChangeRecoveryKeyPanelProps) {
  const [status, setStatus] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  return (
    <section>
      <h4>{userHasRecoveryKey ? 'Change Recovery Key' : 'Set Up Recovery Key'}</h4>
      <p className="settings-note">
        This creates a fresh server-side key backup version and rotates the recovery key for this account.
      </p>
      <p className="settings-note settings-note--warn">
        Save the new recovery key immediately after rotation. Older backup versions may no longer be restorable.
      </p>

      {status && (
        <p className="settings-note" aria-live="polite">
          {status}
        </p>
      )}

      <div className="settings-actions-row settings-actions-row--inline">
        <Tooltip label="Create a new backup version and rotate recovery key">
          <button
            className="settings-btn"
            onClick={async () => {
              setIsSaving(true);
              setStatus('Rotating recovery key…');
              try {
                await onResetKeyBackup();
                setStatus('Recovery key rotated successfully. Refresh key status and save the newly generated key in your trusted client.');
                onFinish();
              } catch (error) {
                setStatus(error instanceof Error ? error.message : 'Unable to rotate recovery key.');
              } finally {
                setIsSaving(false);
              }
            }}
            disabled={isSaving}
          >
            {isSaving ? 'Rotating…' : 'Rotate Recovery Key'}
          </button>
        </Tooltip>

        <button className="settings-btn settings-btn--secondary" onClick={onCancelClick}>
          Back
        </button>
      </div>
    </section>
  );
}
