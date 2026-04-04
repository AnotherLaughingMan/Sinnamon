import type { MatrixConfig } from '../matrix/types';

const PROFILE_STORAGE_KEY = 'sinnamon-matrix-profile';
const ACCESS_TOKEN_STORAGE_KEY = 'sinnamon-matrix-access-token';

type PersistedProfile = Omit<MatrixConfig, 'accessToken'>;

export const EMPTY_CONFIG: MatrixConfig = {
  homeserverUrl: '',
  accessToken: '',
  userId: '',
  deviceId: '',
  rememberCredentials: false,
};

function normalizeProfile(value: Partial<PersistedProfile>): PersistedProfile {
  return {
    homeserverUrl: value.homeserverUrl ?? '',
    userId: value.userId ?? '',
    deviceId: value.deviceId ?? '',
    rememberCredentials: Boolean(value.rememberCredentials),
  };
}

function readJsonValue<T>(storage: Storage, key: string): T | null {
  const rawValue = storage.getItem(key);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return null;
  }
}

function readStoredAccessToken(localStorage: Storage, sessionStorage: Storage) {
  const localAccessToken = localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)?.trim();
  if (localAccessToken) {
    return { accessToken: localAccessToken, rememberCredentials: true };
  }

  const sessionAccessToken = sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)?.trim();
  if (sessionAccessToken) {
    return { accessToken: sessionAccessToken, rememberCredentials: false };
  }

  return { accessToken: '', rememberCredentials: false };
}

export function loadPersistedConfig(localStorage: Storage, sessionStorage: Storage): MatrixConfig {
  const storedProfile = readJsonValue<Partial<PersistedProfile>>(localStorage, PROFILE_STORAGE_KEY);
  const profile = storedProfile ? normalizeProfile(storedProfile) : EMPTY_CONFIG;
  const tokenState = readStoredAccessToken(localStorage, sessionStorage);

  return {
    homeserverUrl: profile.homeserverUrl,
    userId: profile.userId,
    deviceId: profile.deviceId,
    rememberCredentials: tokenState.accessToken ? tokenState.rememberCredentials : profile.rememberCredentials,
    accessToken: tokenState.accessToken,
  };
}

export function persistConfig(config: MatrixConfig, localStorage: Storage, sessionStorage: Storage) {
  const profile: PersistedProfile = {
    homeserverUrl: config.homeserverUrl,
    userId: config.userId,
    deviceId: config.deviceId,
    rememberCredentials: config.rememberCredentials,
  };

  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));

  const trimmedAccessToken = config.accessToken.trim();
  if (config.rememberCredentials && trimmedAccessToken) {
    localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, trimmedAccessToken);
    sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    return;
  }

  localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);

  if (trimmedAccessToken) {
    sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, trimmedAccessToken);
  } else {
    sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  }
}
