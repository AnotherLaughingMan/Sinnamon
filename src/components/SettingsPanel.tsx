import { useEffect, useState } from 'react';
import { getRetentionSummaryLabel } from '../matrix/retention';
import type { MatrixConfig } from '../matrix/types';

type SettingsPanelProps = {
  initialValue: MatrixConfig;
  isOpen: boolean;
  onClose: () => void;
  onSave: (value: MatrixConfig) => void;
  onConnect: (value: MatrixConfig) => void;
};

export function SettingsPanel({
  initialValue,
  isOpen,
  onClose,
  onSave,
  onConnect,
}: SettingsPanelProps) {
  const [draft, setDraft] = useState<MatrixConfig>(initialValue);
  const retentionLabel = getRetentionSummaryLabel();

  useEffect(() => {
    setDraft(initialValue);
  }, [initialValue]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="settings-overlay" role="dialog" aria-modal="true" aria-label="Settings">
      <div className="settings-panel">
        <header>
          <h3>Settings</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close settings">
            ✕
          </button>
        </header>

        <section>
          <h4>Matrix Connection</h4>
          <label>
            Homeserver URL
            <input
              value={draft.homeserverUrl}
              onChange={(event) =>
                setDraft((previous) => ({ ...previous, homeserverUrl: event.target.value }))
              }
              placeholder="https://matrix.example.com"
            />
          </label>

          <label>
            Access Token
            <input
              value={draft.accessToken}
              onChange={(event) =>
                setDraft((previous) => ({ ...previous, accessToken: event.target.value }))
              }
              placeholder="syt_xxx"
              type="password"
            />
          </label>

          <label>
            User ID
            <input
              value={draft.userId}
              onChange={(event) =>
                setDraft((previous) => ({ ...previous, userId: event.target.value }))
              }
              placeholder="@user:matrix.example.com"
            />
          </label>

          <p className="settings-note" aria-label="Message retention policy">
            {retentionLabel}
          </p>
        </section>

        <footer>
          <button
            className="settings-btn"
            onClick={() => {
              onSave(draft);
              onConnect(draft);
            }}
          >
            Save + Connect
          </button>
        </footer>
      </div>
    </div>
  );
}