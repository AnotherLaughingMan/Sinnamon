import { useState } from 'react';
import { Tooltip } from '../../components/Tooltip';

type DeleteKeyStoragePanelProps = {
  onDisableKeyStorage: () => Promise<void>;
  onFinish: () => void;
  onCancel: () => void;
};

export function DeleteKeyStoragePanel({
  onDisableKeyStorage,
  onFinish,
  onCancel,
}: DeleteKeyStoragePanelProps) {
  const [status, setStatus] = useState('');
  const [isDisabling, setIsDisabling] = useState(false);

  return (
    <section>
      <h4>Turn Off Key Storage</h4>
      <p className="settings-note settings-note--warn">
        This removes key-storage metadata and backup secrets for this account and disables encrypted key backup until you set it up again.
      </p>
      <p className="settings-note">
        Make sure you exported room keys from a trusted device before continuing.
      </p>

      {status && (
        <p className="settings-note" aria-live="polite">
          {status}
        </p>
      )}

      <div className="settings-actions-row settings-actions-row--inline">
        <Tooltip label="Disable key storage and remove recovery metadata">
          <button
            className="settings-btn settings-btn--danger"
            onClick={async () => {
              setIsDisabling(true);
              setStatus('Disabling key storage…');
              try {
                await onDisableKeyStorage();
                setStatus('Key storage disabled.');
                onFinish();
              } catch (error) {
                setStatus(error instanceof Error ? error.message : 'Unable to disable key storage.');
              } finally {
                setIsDisabling(false);
              }
            }}
            disabled={isDisabling}
          >
            {isDisabling ? 'Disabling…' : 'Disable Key Storage'}
          </button>
        </Tooltip>

        <button className="settings-btn settings-btn--secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}
