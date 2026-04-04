import { useEffect, useState } from 'react';
import { Info, Key, Shield, ShieldCheck, Wifi, X } from 'lucide-react';
import { getRetentionSummaryLabel } from '../matrix/retention';
import { Tooltip } from './Tooltip';
import { ConnectionSettingsSection } from '../features/connection/ConnectionSettingsSection';
import type { ConnectionLoginRequest } from '../features/connection/ConnectionSettingsSection';
import { EncryptionSettingsTab } from '../features/encryption/EncryptionSettingsTab';
import { KeyTransferSection } from '../features/encryption/KeyTransferSection';
import type { MissingKeyRecoveryOutcome } from '../features/encryption/RecoveryPanel';
import type { ConnectionState, MatrixConfig, MatrixKeyBackupInfo } from '../matrix/types';
import type {
  DeviceVerificationEntry,
  CryptoSessionStatus,
  KeyBackupRestoreResult,
  RoomKeyImportProgress,
  RoomKeyImportResult,
  VerificationSasData,
  VerificationSessionStatus,
  VerificationSummary,
} from '../matrix/matrixCryptoService';

type MatrixLoginRequest = ConnectionLoginRequest;

type SettingsCategory = 'connection' | 'encryption' | 'keys' | 'about';

type SettingsCategoryMeta = {
  label: string;
  tooltip: string;
  title: string;
  description: string;
};

const SETTINGS_CATEGORY_META: Record<SettingsCategory, SettingsCategoryMeta> = {
  connection: {
    label: 'Connection & Login',
    tooltip: 'Homeserver access, credentials, and session behavior',
    title: 'Connection & Login',
    description: 'Configure homeserver access and sign in with password to attach this device to your Matrix session.',
  },
  encryption: {
    label: 'Encryption',
    tooltip: 'Key storage, recovery, verification, and identity reset',
    title: 'Encryption',
    description: 'Manage key storage, backup recovery, verification, and device trust for end-to-end encryption.',
  },
  keys: {
    label: 'Key Transfer',
    tooltip: 'Import and export room keys between clients/devices',
    title: 'Key Transfer',
    description: 'Import exported room keys from another client or export keys from this device for migration and recovery.',
  },
  about: {
    label: 'Help & About',
    tooltip: 'Project references, docs, and implementation notes',
    title: 'Help & About',
    description: 'Reference links, author details, and Matrix API/SDK notes used by this client.',
  },
};

type SettingsPanelProps = {
  initialValue: MatrixConfig;
  initialCategory?: Extract<SettingsCategory, 'connection'>;
  isOpen: boolean;
  onClose: () => void;
  onSave: (value: MatrixConfig) => void;
  onConnect: (value: MatrixConfig) => void | Promise<void>;
  onLogin: (request: MatrixLoginRequest) => Promise<MatrixConfig>;
  connectionState: ConnectionState;
  onCheckKeyBackup: (value: MatrixConfig) => Promise<MatrixKeyBackupInfo | null>;
  onImportRoomKeys: (
    value: MatrixConfig,
    exportedKeysJson: string,
    importPassphrase?: string,
    onProgress?: (progress: RoomKeyImportProgress) => void,
  ) => Promise<RoomKeyImportResult>;
  onExportRoomKeys: (value: MatrixConfig) => Promise<string>;
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
  onGetCryptoSessionStatus: (value: MatrixConfig) => Promise<CryptoSessionStatus>;
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
  selectedRoomUndecryptableCount: number;
  onRecoverMissingKeys: () => Promise<MissingKeyRecoveryOutcome>;
};

export function SettingsPanel({
  initialValue,
  initialCategory = 'connection',
  isOpen,
  onClose,
  onSave,
  onConnect,
  onLogin,
  connectionState,
  onCheckKeyBackup,
  onImportRoomKeys,
  onExportRoomKeys,
  onRestoreKeyBackupWithRecoveryKey,
  onRestoreKeyBackupWithPassphrase,
  onGetCryptoSessionStatus,
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
  selectedRoomUndecryptableCount,
  onRecoverMissingKeys,
}: SettingsPanelProps) {
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>(initialCategory);
  const [draft, setDraft] = useState<MatrixConfig>(initialValue);
  const retentionLabel = getRetentionSummaryLabel();
  const activeCategoryMeta = SETTINGS_CATEGORY_META[activeCategory];

  useEffect(() => {
    setDraft(initialValue);
    setActiveCategory(initialCategory);
  }, [initialCategory, initialValue]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="settings-overlay" role="dialog" aria-modal="true" aria-label="Settings">
      <div className="settings-panel settings-panel--discord">
        <header>
          <div className="settings-header-copy">
            <h3>User Settings</h3>
            <p className="settings-note">Connection, encryption, and key recovery for this session.</p>
          </div>
          <Tooltip label="Close settings">
            <button className="icon-btn" onClick={onClose} aria-label="Close settings">
              <X size={18} aria-hidden="true" />
            </button>
          </Tooltip>
        </header>

        <div className="settings-shell">
          <aside className="settings-nav" aria-label="Settings categories">
            <p className="settings-nav-group-title">Session</p>
            <Tooltip label={SETTINGS_CATEGORY_META.connection.tooltip}>
              <button
                className={`settings-nav-btn ${activeCategory === 'connection' ? 'settings-nav-btn--active' : ''}`}
                onClick={() => setActiveCategory('connection')}
                aria-pressed={activeCategory === 'connection'}
              >
                <Wifi size={15} aria-hidden="true" />
                {SETTINGS_CATEGORY_META.connection.label}
              </button>
            </Tooltip>

            <p className="settings-nav-group-title">Security</p>
            <Tooltip label={SETTINGS_CATEGORY_META.encryption.tooltip}>
              <button
                className={`settings-nav-btn ${activeCategory === 'encryption' ? 'settings-nav-btn--active' : ''}`}
                onClick={() => setActiveCategory('encryption')}
                aria-pressed={activeCategory === 'encryption'}
              >
                <ShieldCheck size={15} aria-hidden="true" />
                {SETTINGS_CATEGORY_META.encryption.label}
              </button>
            </Tooltip>
            <Tooltip label={SETTINGS_CATEGORY_META.keys.tooltip}>
              <button
                className={`settings-nav-btn ${activeCategory === 'keys' ? 'settings-nav-btn--active' : ''}`}
                onClick={() => setActiveCategory('keys')}
                aria-pressed={activeCategory === 'keys'}
              >
                <Key size={15} aria-hidden="true" />
                {SETTINGS_CATEGORY_META.keys.label}
              </button>
            </Tooltip>

            <p className="settings-nav-group-title">Information</p>
            <Tooltip label={SETTINGS_CATEGORY_META.about.tooltip}>
              <button
                className={`settings-nav-btn ${activeCategory === 'about' ? 'settings-nav-btn--active' : ''}`}
                onClick={() => setActiveCategory('about')}
                aria-pressed={activeCategory === 'about'}
              >
                <Info size={15} aria-hidden="true" />
                {SETTINGS_CATEGORY_META.about.label}
              </button>
            </Tooltip>
          </aside>

          <div className="settings-content">
            <section className="settings-category-header" aria-label="Selected category summary">
              <h4>{activeCategoryMeta.title}</h4>
              <p className="settings-note">{activeCategoryMeta.description}</p>
            </section>

            {activeCategory === 'connection' && (
              <ConnectionSettingsSection
                draft={draft}
                connectionState={connectionState}
                onDraftChange={setDraft}
                onLogin={onLogin}
                retentionLabel={retentionLabel}
              />
            )}

            {activeCategory === 'encryption' && (
              <EncryptionSettingsTab
                draft={draft}
                initialUserId={initialValue.userId}
                selectedRoomUndecryptableCount={selectedRoomUndecryptableCount}
                onConnect={onConnect}
                onCheckKeyBackup={onCheckKeyBackup}
                onGetCryptoSessionStatus={onGetCryptoSessionStatus}
                onRecoverMissingKeys={onRecoverMissingKeys}
                onRestoreKeyBackupWithRecoveryKey={onRestoreKeyBackupWithRecoveryKey}
                onRestoreKeyBackupWithPassphrase={onRestoreKeyBackupWithPassphrase}
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
                onResetKeyBackup={onResetKeyBackup}
                onDisableKeyStorage={onDisableKeyStorage}
              />
            )}

            {activeCategory === 'keys' && (
              <KeyTransferSection
                draft={draft}
                onImportRoomKeys={onImportRoomKeys}
                onExportRoomKeys={onExportRoomKeys}
                onConnect={onConnect}
              />
            )}

            {activeCategory === 'about' && (
              <>
                <section>
                  <h4>About Sinnamon</h4>
                  <p className="settings-note">
                    Sinnamon is a custom Matrix client focused on a Discord-like user experience with strong
                    encryption and key recovery tooling.
                  </p>
                  <p className="settings-note">Current app version: 0.3.0</p>
                </section>

                <section>
                  <h4>Author Info</h4>
                  <p className="settings-note">
                    Project author and maintainer profile:
                    {' '}
                    <a
                      className="settings-link"
                      href="https://github.com/AnotherLaughingMan"
                      target="_blank"
                      rel="noreferrer"
                    >
                      AnotherLaughingMan
                    </a>
                  </p>
                </section>

                <section>
                  <h4>Matrix.org Resources</h4>
                  <ul className="settings-link-list">
                    <li>
                      <a
                        className="settings-link"
                        href="https://matrix.org"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Matrix.org Home
                      </a>
                    </li>
                    <li>
                      <a
                        className="settings-link"
                        href="https://spec.matrix.org/latest/client-server-api/"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Matrix Client-Server API Spec
                      </a>
                    </li>
                    <li>
                      <a
                        className="settings-link"
                        href="https://element.io/en/help#encryption5"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Encryption and Key Backup Guidance
                      </a>
                    </li>
                  </ul>
                </section>

                <section>
                  <h4>API and SDK Details</h4>
                  <ul className="settings-link-list">
                    <li>SDK: matrix-js-sdk 41.3.0-rc.0</li>
                    <li>Encryption: Matrix Rust crypto (via matrix-js-sdk)</li>
                    <li>Primary API: Matrix Client-Server API v3</li>
                    <li>Key endpoints used: /login, /sync, /rooms/&#123;roomId&#125;/send, /room_keys/version</li>
                  </ul>
                </section>
              </>
            )}
          </div>
        </div>

        <footer>
          <Tooltip label="Persist current settings and reconnect using this configuration">
            <button
              className="settings-btn"
              onClick={() => {
                onSave(draft);
                onConnect(draft);
              }}
            >
              Save + Connect
            </button>
          </Tooltip>
        </footer>
      </div>
    </div>
  );
}