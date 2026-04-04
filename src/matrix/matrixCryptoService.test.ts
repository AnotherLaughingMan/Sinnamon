import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatrixConfig } from './types';

const initRustCryptoMock = vi.fn();
const importRoomKeysAsJsonMock = vi.fn();
const exportRoomKeysAsJsonMock = vi.fn();
const getCryptoMock = vi.fn();
const createClientMock = vi.fn();
const decryptEventIfNeededMock = vi.fn();
const decodeRecoveryKeyMock = vi.fn();
const getKeyBackupInfoMock = vi.fn();
const storeSessionBackupPrivateKeyMock = vi.fn();
const restoreKeyBackupMock = vi.fn();
const restoreKeyBackupWithPassphraseMock = vi.fn();
const getSessionBackupPrivateKeyMock = vi.fn();
const getActiveSessionBackupVersionMock = vi.fn();
const isKeyBackupKeyStoredMock = vi.fn();
const getCrossSigningStatusMock = vi.fn();
const getSecretStorageStatusMock = vi.fn();
const bootstrapCrossSigningMock = vi.fn();
const checkKeyBackupAndEnableMock = vi.fn();
const resetKeyBackupMock = vi.fn();
const loadSessionBackupPrivateKeyFromSecretStorageMock = vi.fn();
const decryptExportedRoomKeysMock = vi.fn();
const clearStoresMock = vi.fn();
const getUserVerificationStatusMock = vi.fn();
const getVerificationRequestsToDeviceInProgressMock = vi.fn();
const findVerificationRequestDMInProgressMock = vi.fn();
const requestVerificationDMMock = vi.fn();
const getUserDeviceInfoMock = vi.fn();
const getDeviceVerificationStatusMock = vi.fn();
const setDeviceVerifiedMock = vi.fn();
const crossSignDeviceMock = vi.fn();
const verificationRequestAcceptMock = vi.fn();
const verificationRequestCancelMock = vi.fn();
const verificationRequestStartVerificationMock = vi.fn();
const verificationSasConfirmMock = vi.fn();
const verificationSasMismatchMock = vi.fn();
const verificationSasCancelMock = vi.fn();

class MockMatrixEvent {
  private decryptedEvent?: {
    type?: string;
    content?: Record<string, unknown>;
    sender?: string;
    origin_server_ts?: number;
    event_id?: string;
    state_key?: string;
    unsigned?: Record<string, unknown>;
  };

  private failureReason: string | null = null;

  constructor(private readonly rawEvent: Record<string, unknown>) {}

  setDecryptedEvent(value: NonNullable<MockMatrixEvent['decryptedEvent']>) {
    this.decryptedEvent = value;
  }

  setDecryptionFailure(value: string) {
    this.failureReason = value;
  }

  getEffectiveEvent() {
    return {
      ...this.rawEvent,
      ...this.decryptedEvent,
    };
  }

  getId() {
    return (this.decryptedEvent?.event_id as string | undefined) ?? (this.rawEvent.event_id as string | undefined);
  }

  getSender() {
    return (this.decryptedEvent?.sender as string | undefined) ?? (this.rawEvent.sender as string | undefined);
  }

  getType() {
    return (this.decryptedEvent?.type as string | undefined) ?? (this.rawEvent.type as string | undefined) ?? 'm.room.encrypted';
  }

  getContent() {
    return (this.decryptedEvent?.content as Record<string, unknown> | undefined) ?? (this.rawEvent.content as Record<string, unknown> | undefined) ?? {};
  }

  getTs() {
    return (this.decryptedEvent?.origin_server_ts as number | undefined) ?? (this.rawEvent.origin_server_ts as number | undefined) ?? 0;
  }

  isDecryptionFailure() {
    return Boolean(this.failureReason);
  }

  get decryptionFailureReason() {
    return this.failureReason;
  }
}

vi.mock('matrix-js-sdk', () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
  MatrixEvent: MockMatrixEvent,
}));

vi.mock('matrix-js-sdk/lib/crypto-api/recovery-key', () => ({
  decodeRecoveryKey: (...args: unknown[]) => decodeRecoveryKeyMock(...args),
}));

vi.mock('@matrix-org/matrix-sdk-crypto-wasm', () => ({
  OlmMachine: {
    decryptExportedRoomKeys: (...args: unknown[]) => decryptExportedRoomKeysMock(...args),
  },
}));

function makeConfig(overrides: Partial<MatrixConfig> = {}): MatrixConfig {
  return {
    homeserverUrl: 'https://matrix.example.com',
    accessToken: 'token-123',
    userId: '@alice:example.com',
    deviceId: 'DEVICE123',
    rememberCredentials: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();

  initRustCryptoMock.mockResolvedValue(undefined);
  importRoomKeysAsJsonMock.mockResolvedValue(undefined);
  exportRoomKeysAsJsonMock.mockResolvedValue('{"rooms":[]}');
  decodeRecoveryKeyMock.mockReturnValue(new Uint8Array([1, 2, 3]));
  getKeyBackupInfoMock.mockResolvedValue({ version: '7' });
  storeSessionBackupPrivateKeyMock.mockResolvedValue(undefined);
  restoreKeyBackupMock.mockResolvedValue({ total: 12, imported: 9 });
  restoreKeyBackupWithPassphraseMock.mockResolvedValue({ total: 8, imported: 8 });
  getSessionBackupPrivateKeyMock.mockResolvedValue(new Uint8Array([7, 8, 9]));
  getActiveSessionBackupVersionMock.mockResolvedValue('7');
  isKeyBackupKeyStoredMock.mockResolvedValue({ default: { keyInfo: 'exists' } });
  getCrossSigningStatusMock.mockResolvedValue({
    publicKeysOnDevice: true,
    privateKeysInSecretStorage: false,
    privateKeysCachedLocally: {
      masterKey: true,
      selfSigningKey: true,
      userSigningKey: true,
    },
  });
  getSecretStorageStatusMock.mockResolvedValue({
    ready: false,
    defaultKeyId: null,
    secretStorageKeyValidityMap: {},
  });
  bootstrapCrossSigningMock.mockResolvedValue(undefined);
  checkKeyBackupAndEnableMock.mockResolvedValue({ version: '7' });
  resetKeyBackupMock.mockResolvedValue(undefined);
  loadSessionBackupPrivateKeyFromSecretStorageMock.mockResolvedValue(undefined);
  decryptExportedRoomKeysMock.mockReturnValue('[{"room_id":"!room:example.com","session_id":"abc"}]');
  getUserVerificationStatusMock.mockResolvedValue({
    isVerified: () => true,
    isCrossSigningVerified: () => true,
    wasCrossSigningVerified: () => true,
    needsUserApproval: false,
  });
  getVerificationRequestsToDeviceInProgressMock.mockReturnValue([]);
  findVerificationRequestDMInProgressMock.mockReturnValue(undefined);
  verificationRequestAcceptMock.mockResolvedValue(undefined);
  verificationRequestCancelMock.mockResolvedValue(undefined);
  verificationSasConfirmMock.mockResolvedValue(undefined);
  verificationSasMismatchMock.mockReturnValue(undefined);
  verificationSasCancelMock.mockReturnValue(undefined);
  verificationRequestStartVerificationMock.mockResolvedValue({
    getShowSasCallbacks: () => ({
      sas: {
        decimal: [123, 456, 789],
        emoji: [['🐶', 'Dog'], ['🌳', 'Tree']],
      },
      confirm: verificationSasConfirmMock,
      mismatch: verificationSasMismatchMock,
      cancel: verificationSasCancelMock,
    }),
  });
  requestVerificationDMMock.mockResolvedValue({
    transactionId: 'tx-verification-1',
    roomId: '!dm:example.com',
    otherUserId: '@alice:example.com',
    otherDeviceId: undefined,
    initiatedByMe: true,
    phase: 2,
  });
  getUserDeviceInfoMock.mockResolvedValue(
    new Map([
      ['@alice:example.com', new Map([
        ['DEVICE123', { deviceId: 'DEVICE123', displayName: 'Alice Device' }],
      ])],
    ]),
  );
  getDeviceVerificationStatusMock.mockResolvedValue({
    localVerified: false,
    crossSigningVerified: true,
    signedByOwner: true,
    isVerified: () => true,
  });
  setDeviceVerifiedMock.mockResolvedValue(undefined);
  crossSignDeviceMock.mockResolvedValue(undefined);
  getCryptoMock.mockReturnValue({
    importRoomKeysAsJson: importRoomKeysAsJsonMock,
    exportRoomKeysAsJson: exportRoomKeysAsJsonMock,
    getKeyBackupInfo: getKeyBackupInfoMock,
    storeSessionBackupPrivateKey: storeSessionBackupPrivateKeyMock,
    restoreKeyBackup: restoreKeyBackupMock,
    restoreKeyBackupWithPassphrase: restoreKeyBackupWithPassphraseMock,
    getSessionBackupPrivateKey: getSessionBackupPrivateKeyMock,
    getActiveSessionBackupVersion: getActiveSessionBackupVersionMock,
    getCrossSigningStatus: getCrossSigningStatusMock,
    getSecretStorageStatus: getSecretStorageStatusMock,
    bootstrapCrossSigning: bootstrapCrossSigningMock,
    checkKeyBackupAndEnable: checkKeyBackupAndEnableMock,
    resetKeyBackup: resetKeyBackupMock,
    loadSessionBackupPrivateKeyFromSecretStorage: loadSessionBackupPrivateKeyFromSecretStorageMock,
    getVersion: () => 'Rust SDK test-version',
    getUserVerificationStatus: getUserVerificationStatusMock,
    getVerificationRequestsToDeviceInProgress: getVerificationRequestsToDeviceInProgressMock,
    findVerificationRequestDMInProgress: findVerificationRequestDMInProgressMock,
    requestVerificationDM: requestVerificationDMMock,
    getUserDeviceInfo: getUserDeviceInfoMock,
    getDeviceVerificationStatus: getDeviceVerificationStatusMock,
    setDeviceVerified: setDeviceVerifiedMock,
    crossSignDevice: crossSignDeviceMock,
  });
  createClientMock.mockReturnValue({
    initRustCrypto: initRustCryptoMock,
    getCrypto: getCryptoMock,
    decryptEventIfNeeded: decryptEventIfNeededMock,
    isKeyBackupKeyStored: isKeyBackupKeyStoredMock,
    clearStores: clearStoresMock,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('importExportedRoomKeys', () => {
  it('throws when the session has no device ID', async () => {
    const { importExportedRoomKeys } = await import('./matrixCryptoService');

    await expect(
      importExportedRoomKeys(makeConfig({ deviceId: '' }), '{"rooms":[]}'),
    ).rejects.toThrow(
      'This session has no device ID. Log in with password first so encrypted keys can be attached to a device.',
    );

    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('imports exported room keys and reports progress', async () => {
    importRoomKeysAsJsonMock.mockImplementation(
      async (
        _exportedKeysJson: string,
        options?: { progressCallback?: (progress: { stage: string; total: number; successes: number; failures: number }) => void },
      ) => {
        options?.progressCallback?.({
          stage: 'load_keys',
          total: 3,
          successes: 2,
          failures: 1,
        });
      },
    );

    const progressCallback = vi.fn();
    const { importExportedRoomKeys } = await import('./matrixCryptoService');

    const result = await importExportedRoomKeys(makeConfig(), '{"rooms":[]}', progressCallback);

    expect(createClientMock).toHaveBeenCalledWith(expect.objectContaining({
      baseUrl: 'https://matrix.example.com',
      accessToken: 'token-123',
      userId: '@alice:example.com',
      deviceId: 'DEVICE123',
      cryptoCallbacks: expect.any(Object),
    }));
    expect(initRustCryptoMock).toHaveBeenCalledOnce();
    expect(importRoomKeysAsJsonMock).toHaveBeenCalledOnce();
    expect(progressCallback).toHaveBeenCalledWith({
      stage: 'load_keys',
      total: 3,
      successes: 2,
      failures: 1,
    });
    expect(result).toEqual({
      total: 3,
      imported: 2,
      failures: 1,
    });
  });

  it('decrypts passphrase-protected megolm exports before importing', async () => {
    const encryptedExport = [
      '-----BEGIN MEGOLM SESSION DATA-----',
      'ciphertext-data',
      '-----END MEGOLM SESSION DATA-----',
    ].join('\n');

    const { importExportedRoomKeys } = await import('./matrixCryptoService');

    await importExportedRoomKeys(makeConfig(), encryptedExport, undefined, 'passphrase-123');

    expect(decryptExportedRoomKeysMock).toHaveBeenCalledWith(encryptedExport, 'passphrase-123');
    expect(importRoomKeysAsJsonMock).toHaveBeenCalledWith(
      '[{"room_id":"!room:example.com","session_id":"abc"}]',
      expect.any(Object),
    );
  });

  it('asks for a passphrase when importing encrypted megolm export without one', async () => {
    const encryptedExport = [
      '-----BEGIN MEGOLM SESSION DATA-----',
      'ciphertext-data',
      '-----END MEGOLM SESSION DATA-----',
    ].join('\n');

    const { importExportedRoomKeys } = await import('./matrixCryptoService');

    await expect(importExportedRoomKeys(makeConfig(), encryptedExport)).rejects.toThrow(
      'This looks like a passphrase-protected key export. Enter the export passphrase in Import / Export Keys and retry.',
    );

    expect(importRoomKeysAsJsonMock).not.toHaveBeenCalled();
  });
});

describe('exportRoomKeys', () => {
  it('exports current device room keys as JSON', async () => {
    const { exportRoomKeys } = await import('./matrixCryptoService');

    const exported = await exportRoomKeys(makeConfig());

    expect(exportRoomKeysAsJsonMock).toHaveBeenCalledOnce();
    expect(exported).toBe('{"rooms":[]}');
  });

  it('retries client initialization after a crypto startup failure', async () => {
    initRustCryptoMock.mockRejectedValueOnce(new Error('crypto boot failed'));
    const { exportRoomKeys } = await import('./matrixCryptoService');

    await expect(exportRoomKeys(makeConfig())).rejects.toThrow('crypto boot failed');

    exportRoomKeysAsJsonMock.mockResolvedValue('{"rooms":[{"id":"abc"}]}');
    const exported = await exportRoomKeys(makeConfig());

    expect(createClientMock).toHaveBeenCalledTimes(2);
    expect(exported).toBe('{"rooms":[{"id":"abc"}]}');
  });

  it('clears local stores and recovers when crypto account store tuple mismatches', async () => {
    initRustCryptoMock
      .mockRejectedValueOnce(
        new Error("account in the store doesn't match the account in the constructor: expected @alice:example.com:DEVICE_A, got @alice:example.com:DEVICE_B"),
      )
      .mockResolvedValue(undefined);

    const { exportRoomKeys } = await import('./matrixCryptoService');

    const exported = await exportRoomKeys(makeConfig());

    expect(clearStoresMock).toHaveBeenCalledTimes(1);
    expect(createClientMock).toHaveBeenCalledTimes(2);
    expect(initRustCryptoMock).toHaveBeenCalledTimes(3);
    expect(exported).toBe('{"rooms":[]}');
  });

  it('reuses recovered client after account-store mismatch instead of recreating on next call', async () => {
    initRustCryptoMock
      .mockRejectedValueOnce(
        new Error("account in the store doesn't match the account in the constructor: expected @alice:example.com:DEVICE_A, got @alice:example.com:DEVICE_B"),
      )
      .mockResolvedValue(undefined);

    const { exportRoomKeys } = await import('./matrixCryptoService');

    await exportRoomKeys(makeConfig());
    await exportRoomKeys(makeConfig());

    expect(clearStoresMock).toHaveBeenCalledTimes(1);
    expect(createClientMock).toHaveBeenCalledTimes(2);
  });
});

describe('decryptTimelineEvent', () => {
  it('returns decrypted message payload for encrypted timeline events', async () => {
    decryptEventIfNeededMock.mockImplementation(async (event: MockMatrixEvent) => {
      event.setDecryptedEvent({
        type: 'm.room.message',
        sender: '@alice:example.com',
        event_id: '$decrypted',
        origin_server_ts: 250,
        content: {
          msgtype: 'm.text',
          body: 'decrypted hello',
        },
      });
    });

    const { decryptTimelineEvent } = await import('./matrixCryptoService');

    const result = await decryptTimelineEvent(makeConfig(), '!room:example.com', {
      event_id: '$encrypted',
      sender: '@alice:example.com',
      type: 'm.room.encrypted',
      origin_server_ts: 200,
      content: {
        algorithm: 'm.megolm.v1.aes-sha2',
      },
    });

    expect(result).toEqual({
      event: {
        event_id: '$decrypted',
        sender: '@alice:example.com',
        type: 'm.room.message',
        state_key: undefined,
        content: {
          msgtype: 'm.text',
          body: 'decrypted hello',
        },
        origin_server_ts: 250,
        unsigned: {},
      },
      isEncrypted: true,
    });
  });

  it('returns a decryption error when the SDK cannot decrypt the event', async () => {
    decryptEventIfNeededMock.mockImplementation(async (event: MockMatrixEvent) => {
      event.setDecryptionFailure('MEGOLM_UNKNOWN_INBOUND_SESSION_ID');
    });

    const { decryptTimelineEvent } = await import('./matrixCryptoService');

    const result = await decryptTimelineEvent(makeConfig(), '!room:example.com', {
      event_id: '$encrypted',
      sender: '@alice:example.com',
      type: 'm.room.encrypted',
      origin_server_ts: 200,
      content: {
        algorithm: 'm.megolm.v1.aes-sha2',
      },
    });

    expect(result).toEqual({
      event: {
        event_id: '$encrypted',
        sender: '@alice:example.com',
        type: 'm.room.encrypted',
        origin_server_ts: 200,
        content: {
          algorithm: 'm.megolm.v1.aes-sha2',
        },
      },
      isEncrypted: true,
      decryptionError: 'MEGOLM_UNKNOWN_INBOUND_SESSION_ID',
    });
  });
});

describe('restoreKeyBackupWithRecoveryKey', () => {
  it('uses the recovery key to unlock secret storage and restore backup keys with progress reporting', async () => {
    getSecretStorageStatusMock.mockResolvedValue({
      ready: false,
      defaultKeyId: 'ssss-key-1',
      secretStorageKeyValidityMap: {},
    });
    restoreKeyBackupMock.mockImplementation(
      async (options?: { progressCallback?: (progress: { stage: string; total: number; successes: number; failures: number }) => void }) => {
        options?.progressCallback?.({
          stage: 'load_keys',
          total: 12,
          successes: 9,
          failures: 3,
        });
        return { total: 12, imported: 9 };
      },
    );

    const progressCallback = vi.fn();
    const { restoreKeyBackupWithRecoveryKey } = await import('./matrixCryptoService');

    const result = await restoreKeyBackupWithRecoveryKey(
      makeConfig(),
      ' EsTc test recovery key ',
      progressCallback,
    );

    expect(decodeRecoveryKeyMock).toHaveBeenCalledWith('EsTc test recovery key');
    expect(loadSessionBackupPrivateKeyFromSecretStorageMock).toHaveBeenCalledOnce();
    expect(storeSessionBackupPrivateKeyMock).not.toHaveBeenCalled();
    expect(restoreKeyBackupMock).toHaveBeenCalledOnce();
    expect(progressCallback).toHaveBeenCalledWith({
      stage: 'load_keys',
      total: 12,
      successes: 9,
      failures: 3,
    });
    expect(result).toEqual({ total: 12, imported: 9 });
  });

  it('falls back to direct backup-key restore when secret storage is not configured', async () => {
    getSecretStorageStatusMock.mockResolvedValue({
      ready: false,
      defaultKeyId: null,
      secretStorageKeyValidityMap: {},
    });

    const { restoreKeyBackupWithRecoveryKey } = await import('./matrixCryptoService');

    await restoreKeyBackupWithRecoveryKey(makeConfig(), ' EsTc test recovery key ');

    expect(storeSessionBackupPrivateKeyMock).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]), '7');
    expect(loadSessionBackupPrivateKeyFromSecretStorageMock).not.toHaveBeenCalled();
  });

  it('throws when no key backup exists on the server', async () => {
    getKeyBackupInfoMock.mockResolvedValue(null);
    const { restoreKeyBackupWithRecoveryKey } = await import('./matrixCryptoService');

    await expect(
      restoreKeyBackupWithRecoveryKey(makeConfig(), 'EsTc test recovery key'),
    ).rejects.toThrow('No server-side key backup is available for this account.');
  });

  it('maps backup-version mismatch errors to actionable guidance', async () => {
    restoreKeyBackupMock.mockRejectedValue(
      new Error('getBackupDecryptor: key backup on server does not match the decryption key'),
    );
    const { restoreKeyBackupWithRecoveryKey } = await import('./matrixCryptoService');

    await expect(
      restoreKeyBackupWithRecoveryKey(makeConfig(), 'EsTc test recovery key'),
    ).rejects.toThrow(
      'The recovery key or passphrase does not match the current server backup version. This usually means backup was reset and this key cannot restore server-backed history for that version. Exported room keys can still decrypt messages if they came from a device/session that previously had those megolm sessions.',
    );
  });
});

describe('restoreKeyBackupWithPassphrase', () => {
  it('restores server backup keys from a passphrase', async () => {
    restoreKeyBackupWithPassphraseMock.mockImplementation(
      async (
        passphrase: string,
        options?: { progressCallback?: (progress: { stage: string; total: number; successes: number; failures: number }) => void },
      ) => {
        options?.progressCallback?.({
          stage: 'load_keys',
          total: 8,
          successes: 8,
          failures: 0,
        });
        return { total: 8, imported: 8, passphrase };
      },
    );

    const progressCallback = vi.fn();
    const { restoreKeyBackupWithPassphrase } = await import('./matrixCryptoService');

    const result = await restoreKeyBackupWithPassphrase(makeConfig(), ' legacy-passphrase ', progressCallback);

    expect(restoreKeyBackupWithPassphraseMock).toHaveBeenCalledOnce();
    expect(progressCallback).toHaveBeenCalledWith({
      stage: 'load_keys',
      total: 8,
      successes: 8,
      failures: 0,
    });
    expect(result).toEqual({ total: 8, imported: 8 });
  });

  it('throws when no key backup exists on the server', async () => {
    getKeyBackupInfoMock.mockResolvedValue(null);
    const { restoreKeyBackupWithPassphrase } = await import('./matrixCryptoService');

    await expect(
      restoreKeyBackupWithPassphrase(makeConfig(), 'legacy-passphrase'),
    ).rejects.toThrow('No server-side key backup is available for this account.');
  });

  it('maps passphrase backup-version mismatch errors to actionable guidance', async () => {
    restoreKeyBackupWithPassphraseMock.mockRejectedValue(
      new Error('getBackupDecryptor: key backup on server does not match the decryption key'),
    );
    const { restoreKeyBackupWithPassphrase } = await import('./matrixCryptoService');

    await expect(
      restoreKeyBackupWithPassphrase(makeConfig(), 'legacy-passphrase'),
    ).rejects.toThrow(
      'The recovery key or passphrase does not match the current server backup version. This usually means backup was reset and this key cannot restore server-backed history for that version. Exported room keys can still decrypt messages if they came from a device/session that previously had those megolm sessions.',
    );
  });
});

describe('recoverMissingKeysFromBackup', () => {
  it('restores from backup when backup metadata and private key are available', async () => {
    restoreKeyBackupMock.mockResolvedValue({ total: 6, imported: 4 });
    const { recoverMissingKeysFromBackup } = await import('./matrixCryptoService');

    const result = await recoverMissingKeysFromBackup(makeConfig());

    expect(restoreKeyBackupMock).toHaveBeenCalledOnce();
    expect(result).toEqual({
      backupAvailable: true,
      backupPrivateKeyAvailable: true,
      attemptedBackupRestore: true,
      totalFromBackup: 6,
      importedFromBackup: 4,
    });
  });

  it('returns no-op metadata when no backup is configured', async () => {
    getKeyBackupInfoMock.mockResolvedValue(null);
    const { recoverMissingKeysFromBackup } = await import('./matrixCryptoService');

    const result = await recoverMissingKeysFromBackup(makeConfig());

    expect(restoreKeyBackupMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      backupAvailable: false,
      backupPrivateKeyAvailable: false,
      attemptedBackupRestore: false,
      totalFromBackup: 0,
      importedFromBackup: 0,
    });
  });

  it('returns no-op metadata when backup exists but local backup private key is missing', async () => {
    getSessionBackupPrivateKeyMock.mockResolvedValue(null);
    const { recoverMissingKeysFromBackup } = await import('./matrixCryptoService');

    const result = await recoverMissingKeysFromBackup(makeConfig());

    expect(restoreKeyBackupMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      backupAvailable: true,
      backupPrivateKeyAvailable: false,
      attemptedBackupRestore: false,
      totalFromBackup: 0,
      importedFromBackup: 0,
    });
  });
});

describe('initial crypto bootstrap status', () => {
  it('treats secret-storage-backed accounts as existing encrypted sessions', async () => {
    getCrossSigningStatusMock.mockResolvedValue({
      publicKeysOnDevice: false,
      privateKeysInSecretStorage: true,
      privateKeysCachedLocally: {
        masterKey: false,
        selfSigningKey: false,
        userSigningKey: false,
      },
    });
    getKeyBackupInfoMock.mockResolvedValue(null);
    getSecretStorageStatusMock.mockResolvedValue({
      ready: false,
      defaultKeyId: 'ssss-key-1',
      secretStorageKeyValidityMap: {},
    });

    const { checkCrossSigningStatus } = await import('./matrixCryptoService');
    const status = await checkCrossSigningStatus(makeConfig());

    expect(status).toEqual({
      hasCrossSigningKeys: true,
      hasBackupAvailable: false,
      cryptoAvailable: true,
    });
  });
});

describe('bootstrapCrossSigning', () => {
  it('creates new cross-signing keys and backup for a true first-time setup', async () => {
    getCrossSigningStatusMock.mockResolvedValue({
      publicKeysOnDevice: false,
      privateKeysInSecretStorage: false,
      privateKeysCachedLocally: {
        masterKey: false,
        selfSigningKey: false,
        userSigningKey: false,
      },
    });
    getKeyBackupInfoMock.mockResolvedValue(null);
    getSecretStorageStatusMock.mockResolvedValue({
      ready: false,
      defaultKeyId: null,
      secretStorageKeyValidityMap: {},
    });
    checkKeyBackupAndEnableMock.mockResolvedValue(null);

    const { bootstrapCrossSigning } = await import('./matrixCryptoService');
    await bootstrapCrossSigning(makeConfig());

    expect(bootstrapCrossSigningMock).toHaveBeenCalledWith({
      setupNewCrossSigning: true,
      authUploadDeviceSigningKeys: expect.any(Function),
    });
    expect(checkKeyBackupAndEnableMock).toHaveBeenCalledOnce();
    expect(resetKeyBackupMock).toHaveBeenCalledOnce();
  });

  it('does not rerun first-time bootstrap when secret storage already exists', async () => {
    getCrossSigningStatusMock.mockResolvedValue({
      publicKeysOnDevice: false,
      privateKeysInSecretStorage: true,
      privateKeysCachedLocally: {
        masterKey: false,
        selfSigningKey: false,
        userSigningKey: false,
      },
    });
    getKeyBackupInfoMock.mockResolvedValue({ version: '7' });
    getSecretStorageStatusMock.mockResolvedValue({
      ready: false,
      defaultKeyId: 'ssss-key-1',
      secretStorageKeyValidityMap: {},
    });

    const { bootstrapCrossSigning } = await import('./matrixCryptoService');
    await bootstrapCrossSigning(makeConfig());

    expect(bootstrapCrossSigningMock).not.toHaveBeenCalled();
    expect(checkKeyBackupAndEnableMock).toHaveBeenCalledOnce();
    expect(resetKeyBackupMock).not.toHaveBeenCalled();
  });
});

describe('getCryptoSessionStatus', () => {
  it('returns backup key and active version status for the current crypto session', async () => {
    const { getCryptoSessionStatus } = await import('./matrixCryptoService');

    const status = await getCryptoSessionStatus(makeConfig());

    expect(status).toEqual({
      hasDeviceBinding: true,
      rustCryptoReady: true,
      activeBackupVersion: '7',
      hasSessionBackupPrivateKey: true,
      keyStoredInSecretStorage: true,
    });
  });

  it('reports missing local backup keys when no private key is cached', async () => {
    getSessionBackupPrivateKeyMock.mockResolvedValue(null);
    getActiveSessionBackupVersionMock.mockResolvedValue(null);
    isKeyBackupKeyStoredMock.mockResolvedValue(null);

    const { getCryptoSessionStatus } = await import('./matrixCryptoService');

    const status = await getCryptoSessionStatus(makeConfig());

    expect(status).toEqual({
      hasDeviceBinding: true,
      rustCryptoReady: true,
      activeBackupVersion: null,
      hasSessionBackupPrivateKey: false,
      keyStoredInSecretStorage: false,
    });
  });
});

describe('verification helpers', () => {
  it('returns verification summary with DM and to-device request status', async () => {
    getVerificationRequestsToDeviceInProgressMock.mockReturnValue([{ transactionId: 'to-device-1' }]);
    findVerificationRequestDMInProgressMock.mockReturnValue({
      transactionId: 'dm-ver-1',
      roomId: '!dm:example.com',
      otherUserId: '@alice:example.com',
      otherDeviceId: undefined,
      initiatedByMe: true,
      phase: 4,
    });

    const { getVerificationSummary } = await import('./matrixCryptoService');
    const summary = await getVerificationSummary(makeConfig(), '@alice:example.com', '!dm:example.com');

    expect(summary).toEqual({
      cryptoVersion: 'Rust SDK test-version',
      userId: '@alice:example.com',
      isVerified: true,
      isCrossSigningVerified: true,
      wasCrossSigningVerified: true,
      needsUserApproval: false,
      toDeviceRequestsInProgress: 1,
      dmRequestInProgress: {
        transactionId: 'dm-ver-1',
        roomId: '!dm:example.com',
        otherUserId: '@alice:example.com',
        otherDeviceId: undefined,
        initiatedByMe: true,
        phase: 'started',
      },
    });
  });

  it('requests DM verification and returns normalized request status', async () => {
    requestVerificationDMMock.mockResolvedValue({
      transactionId: 'tx-ver-2',
      roomId: '!dm:example.com',
      otherUserId: '@alice:example.com',
      otherDeviceId: undefined,
      initiatedByMe: true,
      phase: 2,
    });

    const { requestVerificationDm } = await import('./matrixCryptoService');
    const request = await requestVerificationDm(makeConfig(), '@alice:example.com', '!dm:example.com');

    expect(requestVerificationDMMock).toHaveBeenCalledWith('@alice:example.com', '!dm:example.com');
    expect(request).toEqual({
      transactionId: 'tx-ver-2',
      roomId: '!dm:example.com',
      otherUserId: '@alice:example.com',
      otherDeviceId: undefined,
      initiatedByMe: true,
      phase: 'requested',
    });
  });

  it('accepts an in-progress DM verification request', async () => {
    findVerificationRequestDMInProgressMock.mockReturnValue({
      transactionId: 'dm-ver-accept',
      roomId: '!dm:example.com',
      otherUserId: '@alice:example.com',
      otherDeviceId: undefined,
      initiatedByMe: false,
      phase: 2,
      accept: verificationRequestAcceptMock,
      cancel: verificationRequestCancelMock,
      startVerification: verificationRequestStartVerificationMock,
      verifier: undefined,
    });

    const { acceptVerificationDmRequest } = await import('./matrixCryptoService');
    const status = await acceptVerificationDmRequest(makeConfig(), '@alice:example.com', '!dm:example.com');

    expect(verificationRequestAcceptMock).toHaveBeenCalledOnce();
    expect(status.phase).toBe('requested');
  });

  it('starts SAS verification and returns decimal/emoji SAS values', async () => {
    findVerificationRequestDMInProgressMock.mockReturnValue({
      transactionId: 'dm-ver-sas',
      roomId: '!dm:example.com',
      otherUserId: '@alice:example.com',
      otherDeviceId: undefined,
      initiatedByMe: true,
      phase: 4,
      accept: verificationRequestAcceptMock,
      cancel: verificationRequestCancelMock,
      startVerification: verificationRequestStartVerificationMock,
      verifier: undefined,
    });

    const { startOrContinueSasVerification } = await import('./matrixCryptoService');
    const sas = await startOrContinueSasVerification(makeConfig(), '@alice:example.com', '!dm:example.com');

    expect(verificationRequestStartVerificationMock).toHaveBeenCalledWith('m.sas.v1');
    expect(sas).toEqual({
      transactionId: 'dm-ver-sas',
      phase: 'started',
      decimals: [123, 456, 789],
      emoji: [
        { symbol: '🐶', name: 'Dog' },
        { symbol: '🌳', name: 'Tree' },
      ],
    });
  });

  it('confirms SAS verification from an in-progress verifier', async () => {
    findVerificationRequestDMInProgressMock.mockReturnValue({
      transactionId: 'dm-ver-confirm',
      roomId: '!dm:example.com',
      otherUserId: '@alice:example.com',
      otherDeviceId: undefined,
      initiatedByMe: true,
      phase: 4,
      accept: verificationRequestAcceptMock,
      cancel: verificationRequestCancelMock,
      startVerification: verificationRequestStartVerificationMock,
      verifier: {
        getShowSasCallbacks: () => ({
          sas: {
            decimal: [123, 456, 789],
            emoji: [['🐶', 'Dog'], ['🌳', 'Tree']],
          },
          confirm: verificationSasConfirmMock,
          mismatch: verificationSasMismatchMock,
          cancel: verificationSasCancelMock,
        }),
      },
    });

    const { confirmSasVerification } = await import('./matrixCryptoService');
    const status = await confirmSasVerification(makeConfig(), '@alice:example.com', '!dm:example.com');

    expect(verificationSasConfirmMock).toHaveBeenCalledOnce();
    expect(status.transactionId).toBe('dm-ver-confirm');
  });

  it('lists user devices with verification state details', async () => {
    const { listUserDeviceVerification } = await import('./matrixCryptoService');
    const devices = await listUserDeviceVerification(makeConfig(), '@alice:example.com');

    expect(devices).toEqual([
      {
        userId: '@alice:example.com',
        deviceId: 'DEVICE123',
        displayName: 'Alice Device',
        isCurrentDevice: true,
        isLocallyVerified: false,
        isVerified: true,
        crossSigningVerified: true,
        signedByOwner: true,
      },
    ]);
  });

  it('sets local verification on a target device', async () => {
    const { setDeviceLocalVerification } = await import('./matrixCryptoService');
    const device = await setDeviceLocalVerification(makeConfig(), '@alice:example.com', 'DEVICE123', true);

    expect(setDeviceVerifiedMock).toHaveBeenCalledWith('@alice:example.com', 'DEVICE123', true);
    expect(device.isLocallyVerified).toBe(false);
    expect(device.isVerified).toBe(true);
  });

  it('cross-signs the current device by default', async () => {
    const { crossSignOwnDevice } = await import('./matrixCryptoService');
    const deviceId = await crossSignOwnDevice(makeConfig({ deviceId: 'DEVICE123' }));

    expect(crossSignDeviceMock).toHaveBeenCalledWith('DEVICE123');
    expect(deviceId).toBe('DEVICE123');
  });
});