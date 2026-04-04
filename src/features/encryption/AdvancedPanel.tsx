import { useEffect, useState } from 'react';
import { Tooltip } from '../../components/Tooltip';
import type { MatrixConfig } from '../../matrix/types';
import type {
  DeviceVerificationEntry,
  VerificationSasData,
  VerificationSessionStatus,
  VerificationSummary,
} from '../../matrix/matrixCryptoService';

type AdvancedPanelProps = {
  draft: MatrixConfig;
  initialUserId: string;
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
  onResetIdentityClick: () => void;
};

export function AdvancedPanel({
  draft,
  initialUserId,
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
  onResetIdentityClick,
}: AdvancedPanelProps) {
  const [verificationTargetUserId, setVerificationTargetUserId] = useState(initialUserId);
  const [verificationRoomId, setVerificationRoomId] = useState('');
  const [verificationDeviceId, setVerificationDeviceId] = useState(draft.deviceId);
  const [verificationStatus, setVerificationStatus] = useState('');
  const [verificationSas, setVerificationSas] = useState<VerificationSasData | null>(null);
  const [deviceVerificationStatus, setDeviceVerificationStatus] = useState('');
  const [isRefreshingVerificationStatus, setIsRefreshingVerificationStatus] = useState(false);
  const [isRequestingVerification, setIsRequestingVerification] = useState(false);

  useEffect(() => {
    setVerificationTargetUserId(initialUserId);
    setVerificationRoomId('');
    setVerificationDeviceId(draft.deviceId);
    setVerificationStatus('');
    setVerificationSas(null);
    setDeviceVerificationStatus('');
  }, [draft.deviceId, initialUserId]);

  return (
    <>
      <section>
        <h4>Trust Status</h4>
        <p className="settings-note">
          Check whether your device and the target user are mutually verified for end-to-end encryption.
        </p>

        <label>
          User ID
          <input
            value={verificationTargetUserId}
            onChange={(event) => setVerificationTargetUserId(event.target.value)}
            placeholder="@user:matrix.org"
          />
        </label>

        {verificationStatus && (
          <p className="settings-note" aria-live="polite">
            {verificationStatus}
          </p>
        )}

        <Tooltip label="Inspect E2EE verification trust and active verification sessions">
          <button
            className="settings-btn settings-btn--secondary"
            onClick={async () => {
              setIsRefreshingVerificationStatus(true);
              setVerificationStatus('Checking trust status…');
              try {
                const summary = await onGetVerificationSummary(
                  draft,
                  verificationTargetUserId,
                  verificationRoomId,
                );
                const verified = summary.isVerified ? 'Verified ✓' : 'Not verified';
                const crossSign = summary.isCrossSigningVerified
                  ? 'cross-signing active'
                  : 'cross-signing not set up';
                const pending =
                  summary.toDeviceRequestsInProgress > 0
                    ? `${summary.toDeviceRequestsInProgress} to-device request(s) pending`
                    : null;
                const dm = summary.dmRequestInProgress
                  ? `DM verification in progress (${summary.dmRequestInProgress.phase})`
                  : null;
                const parts = [verified, crossSign, pending, dm].filter(Boolean);
                setVerificationStatus(parts.join(' · '));
              } catch (error) {
                setVerificationStatus(
                  error instanceof Error ? error.message : 'Unable to check trust status.',
                );
              } finally {
                setIsRefreshingVerificationStatus(false);
              }
            }}
            disabled={isRefreshingVerificationStatus}
          >
            {isRefreshingVerificationStatus ? 'Checking…' : 'Check Trust Status'}
          </button>
        </Tooltip>
      </section>

      <section>
        <h4>Verify a Device</h4>
        <p className="settings-note">
          Start a DM verification session with another device or user. Both sides must be in the same direct-message room.
        </p>

        <label>
          DM Room ID
          <input
            value={verificationRoomId}
            onChange={(event) => setVerificationRoomId(event.target.value)}
            placeholder="!dmRoomId:matrix.org"
          />
        </label>

        {verificationSas && (
          <div className="settings-sas-display" role="status" aria-live="polite">
            <p className="settings-sas-label">Compare these values with the other device:</p>
            {verificationSas.decimals && (
              <p className="settings-sas-decimals">{verificationSas.decimals.join(' – ')}</p>
            )}
            {verificationSas.emoji && verificationSas.emoji.length > 0 && (
              <p className="settings-sas-emoji">
                {verificationSas.emoji.map((e) => `${e.symbol} ${e.name}`).join('  ·  ')}
              </p>
            )}
          </div>
        )}

        <div className="settings-actions-row settings-actions-row--3col">
          <Tooltip label="Send a Matrix DM verification request for device trust setup">
            <button
              className="settings-btn"
              onClick={async () => {
                setIsRequestingVerification(true);
                setVerificationStatus('Sending verification request…');
                try {
                  const req = await onRequestVerificationDm(
                    draft,
                    verificationTargetUserId,
                    verificationRoomId,
                  );
                  setVerificationStatus(
                    `Request sent — waiting for the other device to accept (${req.phase}).`,
                  );
                } catch (error) {
                  setVerificationStatus(
                    error instanceof Error ? error.message : 'Unable to send verification request.',
                  );
                } finally {
                  setIsRequestingVerification(false);
                }
              }}
              disabled={isRequestingVerification}
            >
              {isRequestingVerification ? 'Sending…' : 'Request'}
            </button>
          </Tooltip>

          <Tooltip label="Accept an existing DM verification request from the other device">
            <button
              className="settings-btn settings-btn--secondary"
              onClick={async () => {
                setVerificationStatus('Accepting request…');
                try {
                  const req = await onAcceptVerificationDmRequest(
                    draft,
                    verificationTargetUserId,
                    verificationRoomId,
                  );
                  setVerificationStatus(`Request accepted — proceed to SAS (${req.phase}).`);
                } catch (error) {
                  setVerificationStatus(
                    error instanceof Error ? error.message : 'Unable to accept request.',
                  );
                }
              }}
            >
              Accept
            </button>
          </Tooltip>

          <Tooltip label="Cancel the in-progress DM verification request">
            <button
              className="settings-btn settings-btn--secondary"
              onClick={async () => {
                setVerificationStatus('Cancelling…');
                try {
                  await onCancelVerificationDmRequest(
                    draft,
                    verificationTargetUserId,
                    verificationRoomId,
                  );
                  setVerificationSas(null);
                  setVerificationStatus('Verification cancelled.');
                } catch (error) {
                  setVerificationStatus(
                    error instanceof Error ? error.message : 'Unable to cancel.',
                  );
                }
              }}
            >
              Cancel
            </button>
          </Tooltip>
        </div>

        <div className="settings-actions-row settings-actions-row--inline">
          <Tooltip label="Start or continue SAS verification and load emoji/decimal values">
            <button
              className="settings-btn"
              onClick={async () => {
                setVerificationStatus('Loading SAS values…');
                try {
                  const sas = await onStartOrContinueSasVerification(
                    draft,
                    verificationTargetUserId,
                    verificationRoomId,
                  );
                  setVerificationSas(sas);
                  setVerificationStatus('Compare the values above with the other device, then confirm or report mismatch.');
                } catch (error) {
                  setVerificationStatus(
                    error instanceof Error ? error.message : 'Unable to start SAS.',
                  );
                }
              }}
            >
              Start / Continue SAS
            </button>
          </Tooltip>
        </div>

        {verificationSas && (
          <div className="settings-actions-row settings-actions-row--inline">
            <Tooltip label="Confirm SAS values match to complete verification">
              <button
                className="settings-btn"
                onClick={async () => {
                  setVerificationStatus('Confirming match…');
                  try {
                    await onConfirmSasVerification(
                      draft,
                      verificationTargetUserId,
                      verificationRoomId,
                    );
                    setVerificationSas(null);
                    setVerificationStatus('Verification complete — device is now trusted ✓');
                  } catch (error) {
                    setVerificationStatus(
                      error instanceof Error ? error.message : 'Unable to confirm SAS.',
                    );
                  }
                }}
              >
                Confirm Match
              </button>
            </Tooltip>

            <Tooltip label="Report SAS mismatch and cancel verification for safety">
              <button
                className="settings-btn settings-btn--secondary"
                onClick={async () => {
                  setVerificationStatus('Reporting mismatch…');
                  try {
                    await onMismatchSasVerification(
                      draft,
                      verificationTargetUserId,
                      verificationRoomId,
                    );
                    setVerificationSas(null);
                    setVerificationStatus('Mismatch reported — verification cancelled for safety.');
                  } catch (error) {
                    setVerificationStatus(
                      error instanceof Error ? error.message : 'Unable to report mismatch.',
                    );
                  }
                }}
              >
                Mark Mismatch
              </button>
            </Tooltip>
          </div>
        )}
      </section>

      <section>
        <h4>Device Trust</h4>
        <p className="settings-note">
          Inspect, locally trust, or cross-sign a known device by its device ID.
        </p>

        <label>
          Device ID
          <input
            value={verificationDeviceId}
            onChange={(event) => setVerificationDeviceId(event.target.value)}
            placeholder="DEVICEID123"
          />
        </label>

        {deviceVerificationStatus && (
          <p className="settings-note" role="status" aria-live="polite">
            {deviceVerificationStatus}
          </p>
        )}

        <div className="settings-actions-row settings-actions-row--3col">
          <Tooltip label="List trust state for all known devices of the target user">
            <button
              className="settings-btn settings-btn--secondary"
              onClick={async () => {
                setDeviceVerificationStatus('Loading devices…');
                try {
                  const devices = await onListUserDeviceVerification(draft, verificationTargetUserId);
                  if (devices.length === 0) {
                    setDeviceVerificationStatus('No known devices found for this user.');
                    return;
                  }
                  const lines = devices.map((d) => {
                    const flags = [
                      d.isVerified ? '✓ verified' : '✗ unverified',
                      d.crossSigningVerified ? 'cross-signed' : null,
                      d.isLocallyVerified ? 'locally trusted' : null,
                      d.isCurrentDevice ? '(this device)' : null,
                    ]
                      .filter(Boolean)
                      .join(', ');
                    return `${d.deviceId}: ${flags}`;
                  });
                  setDeviceVerificationStatus(lines.join(' | '));
                } catch (error) {
                  setDeviceVerificationStatus(
                    error instanceof Error ? error.message : 'Unable to list devices.',
                  );
                }
              }}
            >
              List Devices
            </button>
          </Tooltip>

          <Tooltip label="Mark the specified device as locally trusted on this client">
            <button
              className="settings-btn settings-btn--secondary"
              onClick={async () => {
                setDeviceVerificationStatus('Marking device as trusted…');
                try {
                  const device = await onSetDeviceLocalVerification(
                    draft,
                    verificationTargetUserId,
                    verificationDeviceId,
                    true,
                  );
                  setDeviceVerificationStatus(
                    `Device ${device.deviceId} marked locally trusted ✓`,
                  );
                } catch (error) {
                  setDeviceVerificationStatus(
                    error instanceof Error ? error.message : 'Unable to set local trust.',
                  );
                }
              }}
            >
              Mark Trusted
            </button>
          </Tooltip>

          <Tooltip label="Cross-sign the specified device with your self-signing key">
            <button
              className="settings-btn"
              onClick={async () => {
                setDeviceVerificationStatus('Cross-signing device…');
                try {
                  const signedId = await onCrossSignOwnDevice(draft, verificationDeviceId);
                  setDeviceVerificationStatus(
                    `Cross-sign complete for ${signedId} ✓ — refresh device list to confirm.`,
                  );
                } catch (error) {
                  setDeviceVerificationStatus(
                    error instanceof Error ? error.message : 'Unable to cross-sign device.',
                  );
                }
              }}
            >
              Cross-sign
            </button>
          </Tooltip>
        </div>
      </section>

      <section>
        <h4>Identity Reset</h4>
        <p className="settings-note">
          Reset identity if this session is compromised or recovery cannot complete.
        </p>
        <button className="settings-btn settings-btn--secondary" onClick={onResetIdentityClick}>
          Reset Identity
        </button>
      </section>
    </>
  );
}
