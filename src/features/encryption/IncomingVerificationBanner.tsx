import { useState } from 'react';
import { Tooltip } from '../../components/Tooltip';
import type {
  VerificationSasData,
  VerificationSessionStatus,
} from '../../matrix/matrixCryptoService';

type IncomingVerificationBannerProps = {
  request: VerificationSessionStatus;
  onAccept: () => Promise<VerificationSessionStatus>;
  onCancel: () => Promise<VerificationSessionStatus>;
  onStartSas: () => Promise<VerificationSasData>;
  onConfirm: () => Promise<VerificationSessionStatus>;
  onMismatch: () => Promise<VerificationSessionStatus>;
};

export function IncomingVerificationBanner({
  request,
  onAccept,
  onCancel,
  onStartSas,
  onConfirm,
  onMismatch,
}: IncomingVerificationBannerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Incoming verification request');
  const [sas, setSas] = useState<VerificationSasData | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  return (
    <>
      <div className="incoming-verification-banner" role="status" aria-live="polite">
        <span className="incoming-verification-banner__label">
          Verification request from {request.otherUserId}
        </span>
        <button
          className="incoming-verification-banner__action"
          onClick={() => setIsDialogOpen(true)}
        >
          Review
        </button>
      </div>

      {isDialogOpen && (
        <div className="incoming-verification-overlay" role="dialog" aria-modal="true" aria-label="Incoming verification request">
          <div className="incoming-verification-dialog">
            <h3>Incoming Verification</h3>
            <p className="settings-note">
              {request.otherUserId} requested verification in {request.roomId || 'this DM room'}.
            </p>
            <p className="settings-note">Status: {statusMessage}</p>

            {sas && (
              <div className="settings-sas-display" role="status" aria-live="polite">
                <p className="settings-sas-label">Compare these values with the other device:</p>
                {sas.decimals && (
                  <p className="settings-sas-decimals">{sas.decimals.join(' – ')}</p>
                )}
                {sas.emoji && sas.emoji.length > 0 && (
                  <p className="settings-sas-emoji">
                    {sas.emoji.map((e) => `${e.symbol} ${e.name}`).join('  ·  ')}
                  </p>
                )}
              </div>
            )}

            <div className="settings-actions-row settings-actions-row--inline">
              <Tooltip label="Accept the incoming verification request">
                <button
                  className="settings-btn"
                  disabled={isBusy}
                  onClick={async () => {
                    setIsBusy(true);
                    setStatusMessage('Accepting request…');
                    try {
                      const result = await onAccept();
                      setStatusMessage(`Accepted (${result.phase}). Start SAS to continue.`);
                    } catch (error) {
                      setStatusMessage(error instanceof Error ? error.message : 'Unable to accept request.');
                    } finally {
                      setIsBusy(false);
                    }
                  }}
                >
                  Accept
                </button>
              </Tooltip>

              <Tooltip label="Cancel the incoming verification request">
                <button
                  className="settings-btn settings-btn--secondary"
                  disabled={isBusy}
                  onClick={async () => {
                    setIsBusy(true);
                    setStatusMessage('Cancelling request…');
                    try {
                      await onCancel();
                      setSas(null);
                      setStatusMessage('Verification cancelled.');
                      setIsDialogOpen(false);
                    } catch (error) {
                      setStatusMessage(error instanceof Error ? error.message : 'Unable to cancel request.');
                    } finally {
                      setIsBusy(false);
                    }
                  }}
                >
                  Cancel
                </button>
              </Tooltip>

              <button
                className="settings-btn settings-btn--secondary"
                onClick={() => setIsDialogOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="settings-actions-row settings-actions-row--inline">
              <Tooltip label="Show SAS values for manual comparison">
                <button
                  className="settings-btn"
                  disabled={isBusy}
                  onClick={async () => {
                    setIsBusy(true);
                    setStatusMessage('Loading SAS values…');
                    try {
                      const sasData = await onStartSas();
                      setSas(sasData);
                      setStatusMessage('Compare values, then confirm match or mark mismatch.');
                    } catch (error) {
                      setStatusMessage(error instanceof Error ? error.message : 'Unable to start SAS verification.');
                    } finally {
                      setIsBusy(false);
                    }
                  }}
                >
                  Start / Continue SAS
                </button>
              </Tooltip>

              {sas && (
                <>
                  <button
                    className="settings-btn"
                    disabled={isBusy}
                    onClick={async () => {
                      setIsBusy(true);
                      setStatusMessage('Confirming SAS match…');
                      try {
                        const result = await onConfirm();
                        setStatusMessage(`Verification complete (${result.phase}).`);
                        setIsDialogOpen(false);
                      } catch (error) {
                        setStatusMessage(error instanceof Error ? error.message : 'Unable to confirm SAS.');
                      } finally {
                        setIsBusy(false);
                      }
                    }}
                  >
                    Confirm Match
                  </button>

                  <button
                    className="settings-btn settings-btn--secondary"
                    disabled={isBusy}
                    onClick={async () => {
                      setIsBusy(true);
                      setStatusMessage('Reporting SAS mismatch…');
                      try {
                        await onMismatch();
                        setSas(null);
                        setStatusMessage('Mismatch reported. Verification cancelled for safety.');
                        setIsDialogOpen(false);
                      } catch (error) {
                        setStatusMessage(error instanceof Error ? error.message : 'Unable to report mismatch.');
                      } finally {
                        setIsBusy(false);
                      }
                    }}
                  >
                    Mark Mismatch
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
