import type { ConnectionState, MatrixConfig } from '../matrix/types';

export type AppRoute = 'welcome' | 'post_login_security' | 'workspace';

export function resolveAppRoute(
  config: MatrixConfig,
  connectionState: ConnectionState,
  gateFinished: boolean,
): AppRoute {
  const isAuthenticated = Boolean(config.accessToken.trim() && config.userId.trim());
  if (!isAuthenticated) {
    return 'welcome';
  }

  if (connectionState === 'connected' && !gateFinished) {
    return 'post_login_security';
  }

  return 'workspace';
}
