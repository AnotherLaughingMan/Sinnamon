import { useMemo, useState } from 'react';
import { LayoutShell } from '../components/LayoutShell';
import { RoomSettingsDialog, type RoomSettingsDraft } from '../components/RoomSettingsDialog';
import { SettingsPanel } from '../components/SettingsPanel';
import {
  acceptVerificationDmRequest,
  cancelVerificationDmRequest,
  confirmSasVerification,
  crossSignOwnDevice,
  disableKeyStorage,
  exportRoomKeys,
  getCryptoSessionStatus,
  getVerificationSummary,
  importExportedRoomKeys,
  listUserDeviceVerification,
  mismatchSasVerification,
  requestVerificationDm,
  resetKeyBackup,
  restoreKeyBackupWithPassphrase,
  restoreKeyBackupWithRecoveryKey,
  setDeviceLocalVerification,
  startOrContinueSasVerification,
} from '../matrix/matrixCryptoService';
import { fetchKeyBackupVersion } from '../matrix/matrixService';
import type { MatrixConfig, RoomSummary } from '../matrix/types';
import type { useMatrixViewState } from '../state/useMatrixViewState';

type RoomOverrides = Record<string, Pick<RoomSummary, 'name' | 'topic'>>;
type MatrixViewState = ReturnType<typeof useMatrixViewState>;

type WorkspaceViewProps = {
  config: MatrixConfig;
  setConfig: (nextConfig: MatrixConfig) => void;
  matrixViewState: MatrixViewState;
  onLogin: (request: {
    homeserverUrl: string;
    username: string;
    password: string;
    loginType: 'username' | 'email';
    rememberCredentials: boolean;
  }) => Promise<MatrixConfig>;
};

export function WorkspaceView({ config, setConfig, matrixViewState, onLogin }: WorkspaceViewProps) {
  const [isUserSettingsOpen, setIsUserSettingsOpen] = useState(false);
  const [isRoomSettingsOpen, setIsRoomSettingsOpen] = useState(false);
  const [isMemberPanelOpen, setIsMemberPanelOpen] = useState(true);
  const [rightPanelMode, setRightPanelMode] = useState<'members' | 'info'>('members');
  const [roomOverridesById, setRoomOverridesById] = useState<RoomOverrides>({});

  const roomsWithOverrides = useMemo(
    () =>
      matrixViewState.rooms.map((room) => {
        const overrides = roomOverridesById[room.id];
        if (!overrides) {
          return room;
        }

        return {
          ...room,
          name: overrides.name,
          topic: overrides.topic,
        };
      }),
    [matrixViewState.rooms, roomOverridesById],
  );

  const selectedRoomName = useMemo(
    () => roomOverridesById[matrixViewState.selectedRoomId]?.name ?? matrixViewState.selectedRoom?.name ?? 'general',
    [matrixViewState.selectedRoom?.name, matrixViewState.selectedRoomId, roomOverridesById],
  );
  const selectedRoomTopic = useMemo(
    () => roomOverridesById[matrixViewState.selectedRoomId]?.topic ?? matrixViewState.selectedRoom?.topic ?? '',
    [matrixViewState.selectedRoom?.topic, matrixViewState.selectedRoomId, roomOverridesById],
  );
  const selectedRoomEncrypted = useMemo(
    () => matrixViewState.selectedRoom?.isEncrypted ?? false,
    [matrixViewState.selectedRoom?.isEncrypted],
  );

  return (
    <>
      <LayoutShell
        rooms={roomsWithOverrides}
        messages={matrixViewState.roomMessages}
        selectedRoomId={matrixViewState.selectedRoomId}
        selectedRoomName={selectedRoomName}
        selectedRoomTopic={selectedRoomTopic}
        selectedRoomEncrypted={selectedRoomEncrypted}
        selectedRoomMembers={matrixViewState.selectedRoomMembers}
        selectedRoomTyping={matrixViewState.selectedRoomTyping}
        connectionState={matrixViewState.connectionState}
        connectionError={matrixViewState.error}
        onSelectRoom={matrixViewState.selectRoom}
        onSendMessage={matrixViewState.sendMessage}
        isSendingMessage={matrixViewState.isSendingMessage}
        isMemberPanelOpen={isMemberPanelOpen}
        rightPanelMode={rightPanelMode}
        onCloseRightPanel={() => setIsMemberPanelOpen(false)}
        onToggleMemberPanel={() => {
          if (isMemberPanelOpen && rightPanelMode === 'members') {
            setIsMemberPanelOpen(false);
            return;
          }
          setRightPanelMode('members');
          setIsMemberPanelOpen(true);
        }}
        onToggleRoomInfoPanel={() => {
          if (isMemberPanelOpen && rightPanelMode === 'info') {
            setIsMemberPanelOpen(false);
            return;
          }
          setRightPanelMode('info');
          setIsMemberPanelOpen(true);
        }}
        onOpenSettings={() => setIsUserSettingsOpen(true)}
        onOpenRoomSettings={() => setIsRoomSettingsOpen(true)}
        onSetTyping={matrixViewState.setTyping}
        pendingVerificationRequest={matrixViewState.pendingVerificationRequest}
        onAcceptIncomingVerification={async () => {
          if (!matrixViewState.pendingVerificationRequest?.roomId) {
            throw new Error('Incoming verification request is missing room context.');
          }
          return acceptVerificationDmRequest(
            config,
            matrixViewState.pendingVerificationRequest.otherUserId,
            matrixViewState.pendingVerificationRequest.roomId,
          );
        }}
        onCancelIncomingVerification={async () => {
          if (!matrixViewState.pendingVerificationRequest?.roomId) {
            throw new Error('Incoming verification request is missing room context.');
          }
          return cancelVerificationDmRequest(
            config,
            matrixViewState.pendingVerificationRequest.otherUserId,
            matrixViewState.pendingVerificationRequest.roomId,
          );
        }}
        onStartIncomingVerificationSas={async () => {
          if (!matrixViewState.pendingVerificationRequest?.roomId) {
            throw new Error('Incoming verification request is missing room context.');
          }
          return startOrContinueSasVerification(
            config,
            matrixViewState.pendingVerificationRequest.otherUserId,
            matrixViewState.pendingVerificationRequest.roomId,
          );
        }}
        onConfirmIncomingVerificationSas={async () => {
          if (!matrixViewState.pendingVerificationRequest?.roomId) {
            throw new Error('Incoming verification request is missing room context.');
          }
          return confirmSasVerification(
            config,
            matrixViewState.pendingVerificationRequest.otherUserId,
            matrixViewState.pendingVerificationRequest.roomId,
          );
        }}
        onMismatchIncomingVerificationSas={async () => {
          if (!matrixViewState.pendingVerificationRequest?.roomId) {
            throw new Error('Incoming verification request is missing room context.');
          }
          return mismatchSasVerification(
            config,
            matrixViewState.pendingVerificationRequest.otherUserId,
            matrixViewState.pendingVerificationRequest.roomId,
          );
        }}
      />
      <RoomSettingsDialog
        isOpen={isRoomSettingsOpen}
        roomId={matrixViewState.selectedRoomId}
        roomName={selectedRoomName}
        roomTopic={selectedRoomTopic}
        isEncrypted={selectedRoomEncrypted}
        memberCount={matrixViewState.selectedRoomMembers.length}
        onClose={() => setIsRoomSettingsOpen(false)}
        onSave={(draft: RoomSettingsDraft) => {
          setRoomOverridesById((previous) => ({
            ...previous,
            [matrixViewState.selectedRoomId]: {
              name: draft.roomName.trim() || selectedRoomName,
              topic: draft.roomTopic.trim(),
            },
          }));
          setIsRoomSettingsOpen(false);
        }}
      />
      <SettingsPanel
        initialValue={config}
        isOpen={isUserSettingsOpen}
        onClose={() => setIsUserSettingsOpen(false)}
        onSave={setConfig}
        onConnect={matrixViewState.connect}
        connectionState={matrixViewState.connectionState}
        onLogin={onLogin}
        onCheckKeyBackup={(nextConfig) => fetchKeyBackupVersion(nextConfig)}
        onImportRoomKeys={(nextConfig, exportedKeysJson, importPassphrase, onProgress) =>
          importExportedRoomKeys(nextConfig, exportedKeysJson, onProgress, importPassphrase)
        }
        onExportRoomKeys={(nextConfig) => exportRoomKeys(nextConfig)}
        onRestoreKeyBackupWithRecoveryKey={(nextConfig, recoveryKey, onProgress) =>
          restoreKeyBackupWithRecoveryKey(nextConfig, recoveryKey, onProgress)
        }
        onRestoreKeyBackupWithPassphrase={(nextConfig, passphrase, onProgress) =>
          restoreKeyBackupWithPassphrase(nextConfig, passphrase, onProgress)
        }
        onGetCryptoSessionStatus={(nextConfig) => getCryptoSessionStatus(nextConfig)}
        onGetVerificationSummary={(nextConfig, targetUserId, verificationRoomId) =>
          getVerificationSummary(nextConfig, targetUserId, verificationRoomId)
        }
        onRequestVerificationDm={(nextConfig, targetUserId, roomId) =>
          requestVerificationDm(nextConfig, targetUserId, roomId)
        }
        onAcceptVerificationDmRequest={(nextConfig, targetUserId, roomId) =>
          acceptVerificationDmRequest(nextConfig, targetUserId, roomId)
        }
        onCancelVerificationDmRequest={(nextConfig, targetUserId, roomId) =>
          cancelVerificationDmRequest(nextConfig, targetUserId, roomId)
        }
        onStartOrContinueSasVerification={(nextConfig, targetUserId, roomId) =>
          startOrContinueSasVerification(nextConfig, targetUserId, roomId)
        }
        onConfirmSasVerification={(nextConfig, targetUserId, roomId) =>
          confirmSasVerification(nextConfig, targetUserId, roomId)
        }
        onMismatchSasVerification={(nextConfig, targetUserId, roomId) =>
          mismatchSasVerification(nextConfig, targetUserId, roomId)
        }
        onListUserDeviceVerification={(nextConfig, targetUserId) =>
          listUserDeviceVerification(nextConfig, targetUserId)
        }
        onSetDeviceLocalVerification={(nextConfig, targetUserId, deviceId, verified) =>
          setDeviceLocalVerification(nextConfig, targetUserId, deviceId, verified)
        }
        onCrossSignOwnDevice={(nextConfig, deviceId) => crossSignOwnDevice(nextConfig, deviceId)}
        onResetKeyBackup={(nextConfig) => resetKeyBackup(nextConfig)}
        onDisableKeyStorage={(nextConfig) => disableKeyStorage(nextConfig)}
        selectedRoomUndecryptableCount={matrixViewState.selectedRoomUndecryptableCount}
        onRecoverMissingKeys={() => matrixViewState.recoverMissingKeys(matrixViewState.selectedRoomId)}
      />
    </>
  );
}
