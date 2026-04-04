import { MatrixEvent, createClient, type MatrixClient } from 'matrix-js-sdk';
import { decodeRecoveryKey } from 'matrix-js-sdk/lib/crypto-api/recovery-key';
import { OlmMachine } from '@matrix-org/matrix-sdk-crypto-wasm';
import type { MatrixConfig } from './types';

type MatrixCryptoCallbacks = NonNullable<Parameters<typeof createClient>[0]['cryptoCallbacks']>;

type RawTimelineEvent = {
  event_id?: string;
  sender?: string;
  type?: string;
  origin_server_ts?: number;
  state_key?: string;
  content?: Record<string, unknown>;
  unsigned?: Record<string, unknown>;
};

export type TimelineEventDecryptionResult = {
  event: RawTimelineEvent;
  isEncrypted: boolean;
  decryptionError?: string;
};

export type RoomKeyImportProgress = {
  stage: string;
  total: number;
  successes: number;
  failures: number;
};

export type RoomKeyImportResult = {
  total: number;
  imported: number;
  failures: number;
};

export type KeyBackupRestoreResult = {
  total: number;
  imported: number;
};

export type MissingKeysRecoveryResult = {
  backupAvailable: boolean;
  backupPrivateKeyAvailable: boolean;
  attemptedBackupRestore: boolean;
  totalFromBackup: number;
  importedFromBackup: number;
};

export type CryptoSessionStatus = {
  hasDeviceBinding: boolean;
  rustCryptoReady: boolean;
  activeBackupVersion: string | null;
  hasSessionBackupPrivateKey: boolean;
  keyStoredInSecretStorage: boolean;
};

export type VerificationSessionStatus = {
  transactionId: string;
  roomId?: string;
  otherUserId: string;
  otherDeviceId?: string;
  initiatedByMe: boolean;
  phase: string;
};

export type VerificationSummary = {
  cryptoVersion: string;
  userId: string;
  isVerified: boolean;
  isCrossSigningVerified: boolean;
  wasCrossSigningVerified: boolean;
  needsUserApproval: boolean;
  toDeviceRequestsInProgress: number;
  dmRequestInProgress?: VerificationSessionStatus;
};

export type DeviceVerificationEntry = {
  userId: string;
  deviceId: string;
  displayName: string;
  isCurrentDevice: boolean;
  isLocallyVerified: boolean;
  isVerified: boolean;
  crossSigningVerified: boolean;
  signedByOwner: boolean;
};

export type VerificationSasData = {
  transactionId: string;
  phase: string;
  decimals?: [number, number, number];
  emoji?: Array<{ symbol: string; name: string }>;
};

const KEY_BACKUP_OPERATION_TIMEOUT_MS = 180000;

function mapProgressWithFallback(
  progress: { stage: string } & Partial<Pick<RoomKeyImportProgress, 'total' | 'successes' | 'failures'>>,
  previous: RoomKeyImportProgress,
) {
  return 'total' in progress && typeof progress.total === 'number'
    ? {
        stage: progress.stage,
        total: progress.total,
        successes: progress.successes ?? 0,
        failures: progress.failures ?? 0,
      }
    : {
        ...previous,
        stage: progress.stage,
      };
}

const cryptoClientPromises = new Map<string, Promise<MatrixClient>>();
const secretStorageKeyCache = new Map<string, { keyId: string | null; privateKey: Uint8Array<ArrayBuffer> }>();

function stripLeadingBom(value: string) {
  return value.replace(/^\uFEFF/, '');
}

function cloneSecretStoragePrivateKey(privateKey: Uint8Array): Uint8Array<ArrayBuffer> {
  const copiedBuffer = new ArrayBuffer(privateKey.byteLength);
  new Uint8Array(copiedBuffer).set(privateKey);
  return new Uint8Array(copiedBuffer);
}

function cacheSecretStorageKey(clientKey: string, keyId: string | null, privateKey: Uint8Array) {
  secretStorageKeyCache.set(clientKey, { keyId, privateKey: cloneSecretStoragePrivateKey(privateKey) });
}

function createCryptoCallbacks(clientKey: string): MatrixCryptoCallbacks {
  return {
    getSecretStorageKey: async (
      opts: { keys: Record<string, unknown> },
    ): Promise<[string, Uint8Array<ArrayBuffer>] | null> => {
      const cachedKey = secretStorageKeyCache.get(clientKey);
      if (!cachedKey) {
        return null;
      }

      if (cachedKey.keyId && cachedKey.keyId in opts.keys) {
        return [cachedKey.keyId, cachedKey.privateKey];
      }

      const availableKeyIds = Object.keys(opts.keys);
      if (availableKeyIds.length === 1) {
        return [availableKeyIds[0], cachedKey.privateKey];
      }

      return null;
    },
    cacheSecretStorageKey: (keyId: string, _keyInfo: unknown, key: Uint8Array<ArrayBuffer>) => {
      cacheSecretStorageKey(clientKey, keyId, key);
    },
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

function mapKeyBackupRestoreError(error: unknown) {
  if (!(error instanceof Error)) {
    return error;
  }

  const normalizedMessage = error.message.toLowerCase();
  if (
    normalizedMessage.includes('key backup on server does not match the decryption key')
    || normalizedMessage.includes('does not match the decryption key')
    || normalizedMessage.includes('backup decryptor')
    || normalizedMessage.includes('decryption key does not match backup info')
  ) {
    return new Error(
      'The recovery key or passphrase does not match the current server backup version. This usually means backup was reset and this key cannot restore server-backed history for that version. Exported room keys can still decrypt messages if they came from a device/session that previously had those megolm sessions.',
    );
  }

  return error;
}

function formatVerificationPhase(phase: number) {
  const phaseLabelByCode: Record<number, string> = {
    1: 'unsent',
    2: 'requested',
    3: 'ready',
    4: 'started',
    5: 'cancelled',
    6: 'done',
  };
  return phaseLabelByCode[phase] ?? `phase-${phase}`;
}

function mapVerificationRequestToStatus(
  request: {
    transactionId?: string;
    roomId?: string;
    otherUserId: string;
    otherDeviceId?: string;
    initiatedByMe: boolean;
    phase: number;
  },
): VerificationSessionStatus {
  return {
    transactionId: request.transactionId ?? 'pending',
    roomId: request.roomId,
    otherUserId: request.otherUserId,
    otherDeviceId: request.otherDeviceId,
    initiatedByMe: request.initiatedByMe,
    phase: formatVerificationPhase(request.phase),
  };
}

function mapSasData(
  transactionId: string,
  phase: string,
  sas: {
    decimal?: [number, number, number];
    emoji?: Array<[string, string]>;
  },
): VerificationSasData {
  return {
    transactionId,
    phase,
    decimals: sas.decimal,
    emoji: sas.emoji?.map(([symbol, name]) => ({ symbol, name })),
  };
}

function getCryptoOrThrow(client: MatrixClient) {
  const crypto = client.getCrypto();
  if (!crypto) {
    throw new Error('Matrix crypto is not available for this session.');
  }
  return crypto;
}

function getDmVerificationRequestOrThrow(
  crypto: {
    findVerificationRequestDMInProgress: (roomId: string, userId?: string) => unknown;
  },
  targetUserId: string,
  roomId: string,
) {
  const request = crypto.findVerificationRequestDMInProgress(roomId, targetUserId) as
    | {
        transactionId?: string;
        roomId?: string;
        otherUserId: string;
        otherDeviceId?: string;
        initiatedByMe: boolean;
        phase: number;
        accept: () => Promise<void>;
        cancel: () => Promise<void>;
        startVerification: (method: string) => Promise<{
          getShowSasCallbacks: () =>
            | {
                sas: {
                  decimal?: [number, number, number];
                  emoji?: Array<[string, string]>;
                };
                confirm: () => Promise<void>;
                mismatch: () => void;
                cancel: () => void;
              }
            | null;
        }>;
        verifier?: {
          getShowSasCallbacks: () =>
            | {
                sas: {
                  decimal?: [number, number, number];
                  emoji?: Array<[string, string]>;
                };
                confirm: () => Promise<void>;
                mismatch: () => void;
                cancel: () => void;
              }
            | null;
        };
      }
    | undefined;

  if (!request) {
    throw new Error('No in-progress DM verification request was found for this user and room.');
  }

  return request;
}

function looksLikeEncryptedExport(value: string) {
  const normalized = value.toUpperCase();
  return (
    normalized.includes('BEGIN MEGOLM SESSION DATA')
    || (value.includes('"ciphertext"') && value.includes('"mac"') && value.includes('"iv"'))
  );
}

function normalizeExportedRoomKeysJson(
  rawValue: string,
  passphrase?: string,
) {
  const normalized = stripLeadingBom(rawValue).trim();
  if (!normalized) {
    throw new Error('Choose or paste an exported room keys JSON file before importing.');
  }

  if (normalized.startsWith('[')) {
    return normalized;
  }

  const trimmedPassphrase = passphrase?.trim();
  if (trimmedPassphrase) {
    try {
      const decrypted = stripLeadingBom(
        OlmMachine.decryptExportedRoomKeys(normalized, trimmedPassphrase),
      ).trim();
      if (decrypted.startsWith('[')) {
        return decrypted;
      }
    } catch (error) {
      if (looksLikeEncryptedExport(normalized)) {
        throw new Error(
          error instanceof Error
            ? `Unable to decrypt this exported room keys file. Check the passphrase and try again. (${error.message})`
            : 'Unable to decrypt this exported room keys file. Check the passphrase and try again.',
        );
      }
    }
  }

  try {
    const parsed = JSON.parse(normalized) as unknown;
    if (Array.isArray(parsed)) {
      return JSON.stringify(parsed);
    }

    if (parsed && typeof parsed === 'object') {
      const sessionList = (parsed as { sessions?: unknown }).sessions;
      if (Array.isArray(sessionList)) {
        return JSON.stringify(sessionList);
      }

      // Some clients/tools wrap exports in an object shape. Let the SDK validate contents.
      return JSON.stringify(parsed);
    }
  } catch {
    if (looksLikeEncryptedExport(normalized)) {
      throw new Error(
        'This looks like a passphrase-protected key export. Enter the export passphrase in Import / Export Keys and retry.',
      );
    }
  }

  if (looksLikeEncryptedExport(normalized)) {
    throw new Error(
      'This looks like a passphrase-protected key export. Enter the export passphrase in Import / Export Keys and retry.',
    );
  }

  throw new Error(
    'Unsupported room key export format. Provide a Matrix exported room keys file from Element/Cinny (JSON array or encrypted megolm export).',
  );
}

function getCryptoClientKey(config: MatrixConfig) {
  return [
    config.homeserverUrl.trim(),
    config.userId.trim(),
    config.deviceId.trim(),
    config.accessToken.trim(),
  ].join('|');
}

function isCryptoAccountStoreMismatchError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const normalizedMessage = error.message.toLowerCase();
  return normalizedMessage.includes("account in the store doesn't match the account in the constructor");
}

async function clearClientStores(client: MatrixClient) {
  const clearStores = (client as MatrixClient & { clearStores?: () => Promise<void> }).clearStores;
  if (typeof clearStores === 'function') {
    await clearStores.call(client);
  }
}

async function getCryptoClient(config: MatrixConfig): Promise<MatrixClient> {
  const homeserverUrl = config.homeserverUrl.trim();
  const accessToken = config.accessToken.trim();
  const userId = config.userId.trim();
  const deviceId = config.deviceId.trim();

  if (!homeserverUrl || !accessToken || !userId) {
    throw new Error('Login or provide an access token before importing room keys.');
  }

  if (!deviceId) {
    throw new Error('This session has no device ID. Log in with password first so encrypted keys can be attached to a device.');
  }

  const clientKey = getCryptoClientKey(config);
  const existingPromise = cryptoClientPromises.get(clientKey);
  if (existingPromise) {
    return existingPromise;
  }

  const clientPromise = (async () => {
    const client = createClient({
      baseUrl: homeserverUrl,
      accessToken,
      userId,
      deviceId,
      cryptoCallbacks: createCryptoCallbacks(clientKey),
    });

    let clearedStoresForMismatch = false;
    try {
      await client.initRustCrypto();
    } catch (error) {
      if (isCryptoAccountStoreMismatchError(error) && !clearedStoresForMismatch) {
        clearedStoresForMismatch = true;
        await clearClientStores(client);
        await client.initRustCrypto();
      } else {
        cryptoClientPromises.delete(clientKey);
        throw error;
      }
    }

    if (clearedStoresForMismatch) {
      cryptoClientPromises.delete(clientKey);
      const resetClient = createClient({
        baseUrl: homeserverUrl,
        accessToken,
        userId,
        deviceId,
        cryptoCallbacks: createCryptoCallbacks(clientKey),
      });
      try {
        await resetClient.initRustCrypto();
      } catch (error) {
        cryptoClientPromises.delete(clientKey);
        throw error;
      }
      cryptoClientPromises.set(clientKey, Promise.resolve(resetClient));
      return resetClient;
    }

    try {
      return client;
    } catch (error) {
      cryptoClientPromises.delete(clientKey);
      throw error;
    }
  })();

  cryptoClientPromises.set(clientKey, clientPromise);
  return clientPromise;
}

export async function importExportedRoomKeys(
  config: MatrixConfig,
  exportedKeysJson: string,
  onProgress?: (progress: RoomKeyImportProgress) => void,
  importPassphrase?: string,
): Promise<RoomKeyImportResult> {
  const client = await getCryptoClient(config);
  const crypto = client.getCrypto();
  if (!crypto) {
    throw new Error('Matrix crypto is not available for this session.');
  }

  const normalizedExport = normalizeExportedRoomKeysJson(exportedKeysJson, importPassphrase);

  let latestProgress: RoomKeyImportProgress = {
    stage: 'load_keys',
    total: 0,
    successes: 0,
    failures: 0,
  };

  try {
    await crypto.importRoomKeysAsJson(normalizedExport, {
      progressCallback: (progress) => {
        latestProgress = mapProgressWithFallback(progress, latestProgress);
        onProgress?.(latestProgress);
      },
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('The selected export file could not be parsed. Verify that it is a valid Matrix room-keys export.');
    }
    throw error;
  }

  return {
    total: latestProgress.total,
    imported: latestProgress.successes,
    failures: latestProgress.failures,
  };
}

export async function exportRoomKeys(config: MatrixConfig): Promise<string> {
  const client = await getCryptoClient(config);
  const crypto = client.getCrypto();
  if (!crypto) {
    throw new Error('Matrix crypto is not available for this session.');
  }

  return crypto.exportRoomKeysAsJson();
}

export async function getCryptoSessionStatus(config: MatrixConfig): Promise<CryptoSessionStatus> {
  const client = await getCryptoClient(config);
  const crypto = client.getCrypto();
  if (!crypto) {
    throw new Error('Matrix crypto is not available for this session.');
  }

  const [sessionBackupPrivateKey, activeBackupVersion, secretStorageBackupKey] = await Promise.all([
    crypto.getSessionBackupPrivateKey(),
    crypto.getActiveSessionBackupVersion(),
    client.isKeyBackupKeyStored().catch(() => null),
  ]);

  return {
    hasDeviceBinding: Boolean(config.deviceId.trim()),
    rustCryptoReady: true,
    activeBackupVersion,
    hasSessionBackupPrivateKey: Boolean(sessionBackupPrivateKey),
    keyStoredInSecretStorage: Boolean(secretStorageBackupKey),
  };
}

export async function restoreKeyBackupWithRecoveryKey(
  config: MatrixConfig,
  recoveryKey: string,
  onProgress?: (progress: RoomKeyImportProgress) => void,
): Promise<KeyBackupRestoreResult> {
  const trimmedRecoveryKey = recoveryKey.trim();
  if (!trimmedRecoveryKey) {
    throw new Error('Enter a recovery key before restoring server backup keys.');
  }

  const client = await getCryptoClient(config);
  const crypto = getCryptoOrThrow(client);

  const [backupInfo, secretStorageStatus] = await Promise.all([
    crypto.getKeyBackupInfo(),
    crypto.getSecretStorageStatus().catch(() => null),
  ]);
  const backupVersion = backupInfo?.version?.trim();
  if (!backupVersion) {
    throw new Error('No server-side key backup is available for this account.');
  }

  try {
    const privateKey = decodeRecoveryKey(trimmedRecoveryKey);
    if (secretStorageStatus?.defaultKeyId) {
      cacheSecretStorageKey(getCryptoClientKey(config), secretStorageStatus.defaultKeyId, privateKey);
      await crypto.loadSessionBackupPrivateKeyFromSecretStorage();
    } else {
      await crypto.storeSessionBackupPrivateKey(privateKey, backupVersion);
    }

    let latestProgress: RoomKeyImportProgress = {
      stage: 'fetch',
      total: 0,
      successes: 0,
      failures: 0,
    };

    const result = await withTimeout(
      crypto.restoreKeyBackup({
        progressCallback: (progress) => {
          latestProgress = mapProgressWithFallback(progress, latestProgress);
          onProgress?.(latestProgress);
        },
      }),
      KEY_BACKUP_OPERATION_TIMEOUT_MS,
      'Backup restore timed out. Verify homeserver connectivity and retry.',
    );

    return {
      total: result.total,
      imported: result.imported,
    };
  } catch (error) {
    throw mapKeyBackupRestoreError(error);
  }
}

export async function restoreKeyBackupWithPassphrase(
  config: MatrixConfig,
  passphrase: string,
  onProgress?: (progress: RoomKeyImportProgress) => void,
): Promise<KeyBackupRestoreResult> {
  const trimmedPassphrase = passphrase.trim();
  if (!trimmedPassphrase) {
    throw new Error('Enter a key backup passphrase before restoring server backup keys.');
  }

  const client = await getCryptoClient(config);
  const crypto = client.getCrypto();
  if (!crypto) {
    throw new Error('Matrix crypto is not available for this session.');
  }

  const backupInfo = await crypto.getKeyBackupInfo();
  const backupVersion = backupInfo?.version?.trim();
  if (!backupVersion) {
    throw new Error('No server-side key backup is available for this account.');
  }

  try {
    let latestProgress: RoomKeyImportProgress = {
      stage: 'fetch',
      total: 0,
      successes: 0,
      failures: 0,
    };

    const result = await withTimeout(
      crypto.restoreKeyBackupWithPassphrase(trimmedPassphrase, {
        progressCallback: (progress) => {
          latestProgress = mapProgressWithFallback(progress, latestProgress);
          onProgress?.(latestProgress);
        },
      }),
      KEY_BACKUP_OPERATION_TIMEOUT_MS,
      'Backup restore timed out. Verify homeserver connectivity and retry.',
    );

    return {
      total: result.total,
      imported: result.imported,
    };
  } catch (error) {
    throw mapKeyBackupRestoreError(error);
  }
}

export async function decryptTimelineEvent(
  config: MatrixConfig,
  roomId: string,
  event: RawTimelineEvent,
): Promise<TimelineEventDecryptionResult> {
  if (event.type !== 'm.room.encrypted') {
    return {
      event,
      isEncrypted: false,
    };
  }

  try {
    const client = await getCryptoClient(config);
    const matrixEvent = new MatrixEvent({
      event_id: event.event_id,
      room_id: roomId,
      sender: event.sender,
      type: event.type,
      state_key: event.state_key,
      content: event.content ?? {},
      origin_server_ts: event.origin_server_ts ?? Date.now(),
      unsigned: event.unsigned ?? {},
    });

    await client.decryptEventIfNeeded(matrixEvent, { emit: false });

    if (matrixEvent.isDecryptionFailure()) {
      return {
        event,
        isEncrypted: true,
        decryptionError: matrixEvent.decryptionFailureReason ?? 'Unable to decrypt this message yet.',
      };
    }

    const effectiveEvent = matrixEvent.getEffectiveEvent();
    return {
      event: {
        event_id: matrixEvent.getId() ?? event.event_id,
        sender: matrixEvent.getSender() ?? event.sender,
        type: matrixEvent.getType(),
        state_key: effectiveEvent.state_key,
        content: matrixEvent.getContent(),
        origin_server_ts: matrixEvent.getTs(),
        unsigned: effectiveEvent.unsigned,
      },
      isEncrypted: true,
    };
  } catch (error) {
    return {
      event,
      isEncrypted: true,
      decryptionError: error instanceof Error ? error.message : 'Unable to decrypt this message yet.',
    };
  }
}

export async function getVerificationSummary(
  config: MatrixConfig,
  targetUserId: string,
  verificationRoomId?: string,
): Promise<VerificationSummary> {
  const trimmedTargetUserId = targetUserId.trim();
  if (!trimmedTargetUserId) {
    throw new Error('Enter a user ID to inspect verification status.');
  }

  const client = await getCryptoClient(config);
  const crypto = getCryptoOrThrow(client);

  const userVerification = await crypto.getUserVerificationStatus(trimmedTargetUserId);
  const toDeviceRequests = crypto.getVerificationRequestsToDeviceInProgress(trimmedTargetUserId);
  const trimmedRoomId = verificationRoomId?.trim();
  const dmRequest = trimmedRoomId
    ? crypto.findVerificationRequestDMInProgress(trimmedRoomId, trimmedTargetUserId)
    : undefined;

  return {
    cryptoVersion: crypto.getVersion(),
    userId: trimmedTargetUserId,
    isVerified: userVerification.isVerified(),
    isCrossSigningVerified: userVerification.isCrossSigningVerified(),
    wasCrossSigningVerified: userVerification.wasCrossSigningVerified(),
    needsUserApproval: userVerification.needsUserApproval,
    toDeviceRequestsInProgress: toDeviceRequests.length,
    dmRequestInProgress: dmRequest ? mapVerificationRequestToStatus(dmRequest) : undefined,
  };
}

export async function requestVerificationDm(
  config: MatrixConfig,
  targetUserId: string,
  roomId: string,
): Promise<VerificationSessionStatus> {
  const trimmedTargetUserId = targetUserId.trim();
  const trimmedRoomId = roomId.trim();

  if (!trimmedTargetUserId) {
    throw new Error('Enter a user ID before requesting verification.');
  }

  if (!trimmedRoomId) {
    throw new Error('Enter a DM room ID before requesting verification.');
  }

  const client = await getCryptoClient(config);
  const crypto = getCryptoOrThrow(client);

  const request = await crypto.requestVerificationDM(trimmedTargetUserId, trimmedRoomId);
  return mapVerificationRequestToStatus(request);
}

export async function requestOwnUserVerification(
  config: MatrixConfig,
): Promise<VerificationSessionStatus> {
  const crypto = getCryptoOrThrow(await getCryptoClient(config));
  const request = await crypto.requestOwnUserVerification();
  return mapVerificationRequestToStatus(request);
}

export async function acceptVerificationDmRequest(
  config: MatrixConfig,
  targetUserId: string,
  roomId: string,
): Promise<VerificationSessionStatus> {
  const trimmedTargetUserId = targetUserId.trim();
  const trimmedRoomId = roomId.trim();
  if (!trimmedTargetUserId || !trimmedRoomId) {
    throw new Error('Enter both user ID and DM room ID before accepting verification.');
  }

  const crypto = getCryptoOrThrow(await getCryptoClient(config));
  const request = getDmVerificationRequestOrThrow(crypto, trimmedTargetUserId, trimmedRoomId);
  await request.accept();

  return mapVerificationRequestToStatus(request);
}

export async function cancelVerificationDmRequest(
  config: MatrixConfig,
  targetUserId: string,
  roomId: string,
): Promise<VerificationSessionStatus> {
  const trimmedTargetUserId = targetUserId.trim();
  const trimmedRoomId = roomId.trim();
  if (!trimmedTargetUserId || !trimmedRoomId) {
    throw new Error('Enter both user ID and DM room ID before cancelling verification.');
  }

  const crypto = getCryptoOrThrow(await getCryptoClient(config));
  const request = getDmVerificationRequestOrThrow(crypto, trimmedTargetUserId, trimmedRoomId);
  await request.cancel();

  return mapVerificationRequestToStatus(request);
}

export async function startOrContinueSasVerification(
  config: MatrixConfig,
  targetUserId: string,
  roomId: string,
): Promise<VerificationSasData> {
  const trimmedTargetUserId = targetUserId.trim();
  const trimmedRoomId = roomId.trim();
  if (!trimmedTargetUserId || !trimmedRoomId) {
    throw new Error('Enter both user ID and DM room ID before starting SAS verification.');
  }

  const crypto = getCryptoOrThrow(await getCryptoClient(config));
  const request = getDmVerificationRequestOrThrow(crypto, trimmedTargetUserId, trimmedRoomId);
  const transactionId = request.transactionId ?? 'pending';
  const phase = formatVerificationPhase(request.phase);

  const existingCallbacks = request.verifier?.getShowSasCallbacks();
  if (existingCallbacks) {
    return mapSasData(transactionId, phase, existingCallbacks.sas);
  }

  const verifier = await request.startVerification('m.sas.v1');
  const callbacks = verifier.getShowSasCallbacks();
  if (!callbacks) {
    throw new Error('SAS has not been presented yet. Accept/continue verification on the other client, then retry.');
  }

  return mapSasData(transactionId, phase, callbacks.sas);
}

export async function confirmSasVerification(
  config: MatrixConfig,
  targetUserId: string,
  roomId: string,
): Promise<VerificationSessionStatus> {
  const trimmedTargetUserId = targetUserId.trim();
  const trimmedRoomId = roomId.trim();
  if (!trimmedTargetUserId || !trimmedRoomId) {
    throw new Error('Enter both user ID and DM room ID before confirming SAS verification.');
  }

  const crypto = getCryptoOrThrow(await getCryptoClient(config));
  const request = getDmVerificationRequestOrThrow(crypto, trimmedTargetUserId, trimmedRoomId);
  const callbacks = request.verifier?.getShowSasCallbacks();
  if (!callbacks) {
    throw new Error('SAS confirmation is not available yet. Start or continue SAS verification first.');
  }

  await callbacks.confirm();
  return mapVerificationRequestToStatus(request);
}

export async function mismatchSasVerification(
  config: MatrixConfig,
  targetUserId: string,
  roomId: string,
): Promise<VerificationSessionStatus> {
  const trimmedTargetUserId = targetUserId.trim();
  const trimmedRoomId = roomId.trim();
  if (!trimmedTargetUserId || !trimmedRoomId) {
    throw new Error('Enter both user ID and DM room ID before reporting SAS mismatch.');
  }

  const crypto = getCryptoOrThrow(await getCryptoClient(config));
  const request = getDmVerificationRequestOrThrow(crypto, trimmedTargetUserId, trimmedRoomId);
  const callbacks = request.verifier?.getShowSasCallbacks();
  if (!callbacks) {
    throw new Error('SAS mismatch action is not available yet. Start or continue SAS verification first.');
  }

  callbacks.mismatch();
  return mapVerificationRequestToStatus(request);
}

export async function listUserDeviceVerification(
  config: MatrixConfig,
  targetUserId: string,
): Promise<DeviceVerificationEntry[]> {
  const trimmedTargetUserId = targetUserId.trim();
  if (!trimmedTargetUserId) {
    throw new Error('Enter a user ID before listing device verification status.');
  }

  const crypto = getCryptoOrThrow(await getCryptoClient(config));
  const deviceMap = await crypto.getUserDeviceInfo([trimmedTargetUserId], true);
  const userDevices = deviceMap.get(trimmedTargetUserId);
  if (!userDevices) {
    return [];
  }

  const entries = await Promise.all(
    Array.from(userDevices.values()).map(async (device) => {
      const status = await crypto.getDeviceVerificationStatus(trimmedTargetUserId, device.deviceId);

      return {
        userId: trimmedTargetUserId,
        deviceId: device.deviceId,
        displayName: device.displayName?.trim() || 'Unnamed device',
        isCurrentDevice: device.deviceId === config.deviceId.trim(),
        isLocallyVerified: status?.localVerified ?? false,
        isVerified: status?.isVerified() ?? false,
        crossSigningVerified: status?.crossSigningVerified ?? false,
        signedByOwner: status?.signedByOwner ?? false,
      } satisfies DeviceVerificationEntry;
    }),
  );

  return entries.sort((left, right) => {
    if (left.isCurrentDevice !== right.isCurrentDevice) {
      return left.isCurrentDevice ? -1 : 1;
    }
    return left.deviceId.localeCompare(right.deviceId);
  });
}

export async function setDeviceLocalVerification(
  config: MatrixConfig,
  targetUserId: string,
  deviceId: string,
  verified = true,
): Promise<DeviceVerificationEntry> {
  const trimmedTargetUserId = targetUserId.trim();
  const trimmedDeviceId = deviceId.trim();
  if (!trimmedTargetUserId || !trimmedDeviceId) {
    throw new Error('Enter both user ID and device ID before changing verification state.');
  }

  const crypto = getCryptoOrThrow(await getCryptoClient(config));
  await crypto.setDeviceVerified(trimmedTargetUserId, trimmedDeviceId, verified);

  const status = await crypto.getDeviceVerificationStatus(trimmedTargetUserId, trimmedDeviceId);
  return {
    userId: trimmedTargetUserId,
    deviceId: trimmedDeviceId,
    displayName: 'Updated device',
    isCurrentDevice: trimmedDeviceId === config.deviceId.trim(),
    isLocallyVerified: status?.localVerified ?? verified,
    isVerified: status?.isVerified() ?? verified,
    crossSigningVerified: status?.crossSigningVerified ?? false,
    signedByOwner: status?.signedByOwner ?? false,
  };
}

export async function crossSignOwnDevice(
  config: MatrixConfig,
  deviceId?: string,
): Promise<string> {
  const targetDeviceId = (deviceId?.trim() || config.deviceId.trim());
  if (!targetDeviceId) {
    throw new Error('No device ID is available to cross-sign. Log in first.');
  }

  const crypto = getCryptoOrThrow(await getCryptoClient(config));
  await crypto.crossSignDevice(targetDeviceId);
  return targetDeviceId;
}

export async function recoverMissingKeysFromBackup(
  config: MatrixConfig,
  onProgress?: (progress: RoomKeyImportProgress) => void,
): Promise<MissingKeysRecoveryResult> {
  const client = await getCryptoClient(config);
  const crypto = getCryptoOrThrow(client);

  const backupInfo = await crypto.getKeyBackupInfo();
  const backupVersion = backupInfo?.version?.trim();
  if (!backupVersion) {
    return {
      backupAvailable: false,
      backupPrivateKeyAvailable: false,
      attemptedBackupRestore: false,
      totalFromBackup: 0,
      importedFromBackup: 0,
    };
  }

  const backupPrivateKey = await crypto.getSessionBackupPrivateKey();
  if (!backupPrivateKey) {
    return {
      backupAvailable: true,
      backupPrivateKeyAvailable: false,
      attemptedBackupRestore: false,
      totalFromBackup: 0,
      importedFromBackup: 0,
    };
  }

  let latestProgress: RoomKeyImportProgress = {
    stage: 'fetch',
    total: 0,
    successes: 0,
    failures: 0,
  };

  try {
    const result = await withTimeout(
      crypto.restoreKeyBackup({
        progressCallback: (progress) => {
          latestProgress = mapProgressWithFallback(progress, latestProgress);
          onProgress?.(latestProgress);
        },
      }),
      KEY_BACKUP_OPERATION_TIMEOUT_MS,
      'Backup restore timed out. Verify homeserver connectivity and retry.',
    );

    return {
      backupAvailable: true,
      backupPrivateKeyAvailable: true,
      attemptedBackupRestore: true,
      totalFromBackup: result.total,
      importedFromBackup: result.imported,
    };
  } catch (error) {
    throw mapKeyBackupRestoreError(error);
  }
}
export type CrossSigningStatus = {
  hasCrossSigningKeys: boolean;
  hasBackupAvailable: boolean;
  cryptoAvailable: boolean;
};

export async function checkCrossSigningStatus(config: MatrixConfig): Promise<CrossSigningStatus> {
  if (!config.accessToken.trim() || !config.userId.trim()) {
    return { hasCrossSigningKeys: false, hasBackupAvailable: false, cryptoAvailable: false };
  }

  try {
    const client = await getCryptoClient(config);
    const crypto = client.getCrypto();
    if (!crypto) {
      return { hasCrossSigningKeys: false, hasBackupAvailable: false, cryptoAvailable: false };
    }

    const [crossSigningStatus, backupInfo, secretStorageStatus] = await Promise.all([
      crypto.getCrossSigningStatus(),
      crypto.getKeyBackupInfo().catch(() => null),
      crypto.getSecretStorageStatus().catch(() => null),
    ]);

    const hasLocallyCachedKeys = Object.values(crossSigningStatus.privateKeysCachedLocally).some(Boolean);
    const hasExistingEncryptionSetup =
      crossSigningStatus.publicKeysOnDevice
      || crossSigningStatus.privateKeysInSecretStorage
      || hasLocallyCachedKeys
      || Boolean(secretStorageStatus?.defaultKeyId)
      || Boolean(backupInfo?.version);

    return {
      hasCrossSigningKeys: Boolean(hasExistingEncryptionSetup),
      hasBackupAvailable: Boolean(backupInfo?.version),
      cryptoAvailable: true,
    };
  } catch {
    return { hasCrossSigningKeys: false, hasBackupAvailable: false, cryptoAvailable: false };
  }
}

export async function bootstrapCrossSigning(config: MatrixConfig): Promise<void> {
  const client = await getCryptoClient(config);
  const crypto = getCryptoOrThrow(client);

  const [crossSigningStatus, backupInfo, secretStorageStatus] = await Promise.all([
    crypto.getCrossSigningStatus(),
    crypto.getKeyBackupInfo().catch(() => null),
    crypto.getSecretStorageStatus().catch(() => null),
  ]);

  const hasLocallyCachedKeys = Object.values(crossSigningStatus.privateKeysCachedLocally).some(Boolean);
  const hasExistingEncryptionSetup =
    crossSigningStatus.publicKeysOnDevice
    || crossSigningStatus.privateKeysInSecretStorage
    || hasLocallyCachedKeys
    || Boolean(secretStorageStatus?.defaultKeyId)
    || Boolean(backupInfo?.version);

  if (hasExistingEncryptionSetup) {
    await crypto.checkKeyBackupAndEnable();
    return;
  }

  await crypto.bootstrapCrossSigning({
    setupNewCrossSigning: true,
    authUploadDeviceSigningKeys: async (makeRequest) => {
      await makeRequest(null);
    },
  });

  const currentKeyBackup = await crypto.checkKeyBackupAndEnable();
  if (currentKeyBackup === null) {
    await crypto.resetKeyBackup();
  }
}

export async function resetKeyBackup(config: MatrixConfig): Promise<void> {
  const client = await getCryptoClient(config);
  const crypto = getCryptoOrThrow(client);
  await crypto.resetKeyBackup();
}

export async function disableKeyStorage(config: MatrixConfig): Promise<void> {
  const client = await getCryptoClient(config);
  const crypto = getCryptoOrThrow(client);
  await crypto.disableKeyStorage();
}