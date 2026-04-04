import { describe, expect, it } from 'vitest';
import type { MatrixConfig } from '../matrix/types';
import { EMPTY_CONFIG, loadPersistedConfig, persistConfig } from './configPersistence';

function createStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

function makeConfig(overrides: Partial<MatrixConfig> = {}): MatrixConfig {
  return {
    ...EMPTY_CONFIG,
    homeserverUrl: 'https://matrix.org',
    accessToken: 'token-123',
    userId: '@alice:matrix.org',
    deviceId: 'DEVICE123',
    rememberCredentials: false,
    ...overrides,
  };
}

describe('configPersistence', () => {
  it('persists non-sensitive login profile while keeping session tokens out of local storage', () => {
    const localStorage = createStorage();
    const sessionStorage = createStorage();

    persistConfig(makeConfig({ rememberCredentials: false }), localStorage, sessionStorage);

    expect(localStorage.getItem('sinnamon-matrix-profile')).toContain('@alice:matrix.org');
    expect(localStorage.getItem('sinnamon-matrix-access-token')).toBeNull();
    expect(sessionStorage.getItem('sinnamon-matrix-access-token')).toBe('token-123');

    expect(loadPersistedConfig(localStorage, sessionStorage)).toEqual(makeConfig({ rememberCredentials: false }));
  });

  it('persists access token to local storage when remember credentials is enabled', () => {
    const localStorage = createStorage();
    const sessionStorage = createStorage();

    persistConfig(makeConfig({ rememberCredentials: true }), localStorage, sessionStorage);

    expect(localStorage.getItem('sinnamon-matrix-access-token')).toBe('token-123');
    expect(sessionStorage.getItem('sinnamon-matrix-access-token')).toBeNull();

    expect(loadPersistedConfig(localStorage, sessionStorage)).toEqual(makeConfig({ rememberCredentials: true }));
  });

  it('restores profile fields even when the session access token is gone', () => {
    const localStorage = createStorage();
    const sessionStorage = createStorage();

    persistConfig(makeConfig({ rememberCredentials: false }), localStorage, sessionStorage);
    sessionStorage.removeItem('sinnamon-matrix-access-token');

    expect(loadPersistedConfig(localStorage, sessionStorage)).toEqual({
      homeserverUrl: 'https://matrix.org',
      accessToken: '',
      userId: '@alice:matrix.org',
      deviceId: 'DEVICE123',
      rememberCredentials: false,
    });
  });
});