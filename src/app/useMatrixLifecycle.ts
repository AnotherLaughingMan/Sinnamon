import { useCallback, useEffect, useRef, useState } from 'react';
import { loginWithPassword } from '../matrix/matrixService';
import type { ConnectionState, MatrixConfig } from '../matrix/types';
import { loadPersistedConfig, persistConfig } from '../state/configPersistence';
import { useMatrixViewState } from '../state/useMatrixViewState';
import { resolveAppRoute, type AppRoute } from './routes';

export type LoginRequest = {
  homeserverUrl: string;
  username: string;
  password: string;
  loginType: 'username' | 'email';
  rememberCredentials: boolean;
};

type MatrixLifecycleState = {
  config: MatrixConfig;
  setConfig: (nextConfig: MatrixConfig) => void;
  gateFinished: boolean;
  route: AppRoute;
  matrixViewState: ReturnType<typeof useMatrixViewState>;
  loginAndConnect: (request: LoginRequest) => Promise<MatrixConfig>;
  completePostLoginSecurityGate: () => void;
  signOutToPersistedDraft: () => void;
};

export function useMatrixLifecycle(): MatrixLifecycleState {
  const [config, setConfig] = useState<MatrixConfig>(() => loadPersistedConfig(localStorage, sessionStorage));
  const [gateFinished, setGateFinished] = useState(false);
  const previousConnectionStateRef = useRef<ConnectionState>('mock');
  const matrixViewState = useMatrixViewState(config);

  useEffect(() => {
    persistConfig(config, localStorage, sessionStorage);
  }, [config]);

  useEffect(() => {
    const previousState = previousConnectionStateRef.current;
    previousConnectionStateRef.current = matrixViewState.connectionState;
    if (previousState !== 'connected' && matrixViewState.connectionState === 'connected') {
      setGateFinished(false);
    }
  }, [matrixViewState.connectionState]);

  const loginAndConnect = useCallback(
    async ({ homeserverUrl, username, password, loginType, rememberCredentials }: LoginRequest) => {
      const loggedInConfig = await loginWithPassword(homeserverUrl, username, password, {
        deviceId: config.deviceId,
        identifierType: loginType,
      });
      const nextConfig: MatrixConfig = { ...loggedInConfig, rememberCredentials };
      setConfig(nextConfig);
      void matrixViewState.connect(nextConfig);
      return nextConfig;
    },
    [config.deviceId, matrixViewState],
  );

  const completePostLoginSecurityGate = useCallback(() => {
    setGateFinished(true);
  }, []);

  const signOutToPersistedDraft = useCallback(() => {
    setConfig(loadPersistedConfig(localStorage, sessionStorage));
    setGateFinished(false);
  }, []);

  return {
    config,
    setConfig,
    gateFinished,
    route: resolveAppRoute(config, matrixViewState.connectionState, gateFinished),
    matrixViewState,
    loginAndConnect,
    completePostLoginSecurityGate,
    signOutToPersistedDraft,
  };
}
