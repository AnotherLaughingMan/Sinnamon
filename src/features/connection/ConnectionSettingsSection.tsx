import { useRef, useState } from 'react';
import { Tooltip } from '../../components/Tooltip';
import { discoverHomeserverFromMxid } from '../../matrix/matrixService';
import type { ConnectionState, MatrixConfig } from '../../matrix/types';

type LoginType = 'username' | 'email';
export type { LoginType };

export type ConnectionLoginRequest = {
  homeserverUrl: string;
  username: string;
  password: string;
  loginType: LoginType;
  rememberCredentials: boolean;
};

type ConnectionSettingsSectionProps = {
  draft: MatrixConfig;
  connectionState: ConnectionState;
  onDraftChange: (updated: MatrixConfig) => void;
  onLogin: (request: ConnectionLoginRequest) => Promise<MatrixConfig>;
  retentionLabel: string;
};

export function mapLoginError(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Matrix login failed.';
  }
  const msg = error.message;
  if (
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    msg.toLowerCase().includes('network')
  ) {
    return 'Cannot reach homeserver. Check the URL and your internet connection.';
  }
  if (msg.includes('M_FORBIDDEN') || msg.includes('status 401') || msg.includes('status 403')) {
    return 'Incorrect username or password.';
  }
  if (msg.includes('M_USER_IN_USE')) {
    return 'This username is already in use.';
  }
  if (msg.includes('M_INVALID_USERNAME')) {
    return 'Invalid username format.';
  }
  if (msg.includes('M_LIMIT_EXCEEDED')) {
    return 'Too many login attempts. Please wait before trying again.';
  }
  return msg || 'Matrix login failed.';
}

export function ConnectionSettingsSection({
  draft,
  connectionState,
  onDraftChange,
  onLogin,
  retentionLabel,
}: ConnectionSettingsSectionProps) {
  const [loginType, setLoginType] = useState<LoginType>('username');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isDiscoveringHomeserver, setIsDiscoveringHomeserver] = useState(false);
  const discoveryAbortRef = useRef<AbortController | null>(null);

  const displayDeviceId = draft.deviceId.trim();
  const isSyncing = connectionState === 'connecting';
  const isBusy = isLoggingIn || isSyncing;
  const loginButtonLabel = isLoggingIn ? 'Logging In…' : isSyncing ? 'Syncing…' : 'Login + Connect';

  const handleUsernameBlur = async () => {
    const value = loginUsername.trim();
    if (loginType !== 'username' || !value.startsWith('@')) {
      return;
    }
    discoveryAbortRef.current?.abort();
    const controller = new AbortController();
    discoveryAbortRef.current = controller;
    setIsDiscoveringHomeserver(true);
    try {
      const found = await discoverHomeserverFromMxid(value, { signal: controller.signal });
      if (found && !controller.signal.aborted) {
        onDraftChange({ ...draft, homeserverUrl: found });
      }
    } catch {
      // discovery failures are silent — homeserver field stays as-is
    } finally {
      if (!controller.signal.aborted) {
        setIsDiscoveringHomeserver(false);
      }
    }
  };

  const handleLoginClick = async () => {
    if (!draft.homeserverUrl.trim() || !loginUsername.trim() || !loginPassword) {
      setLoginError('Enter homeserver URL, username, and password to log in.');
      return;
    }
    setIsLoggingIn(true);
    setLoginError('');
    try {
      const nextConfig = await onLogin({
        homeserverUrl: draft.homeserverUrl,
        username: loginUsername,
        password: loginPassword,
        loginType,
        rememberCredentials: draft.rememberCredentials,
      });
      onDraftChange(nextConfig);
      setLoginUsername(nextConfig.userId);
      setLoginPassword('');
    } catch (error) {
      setLoginError(mapLoginError(error));
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <>
      <section>
        <h4>Matrix Connection</h4>
        <label>
          Homeserver URL
          <input
            value={draft.homeserverUrl}
            onChange={(e) => onDraftChange({ ...draft, homeserverUrl: e.target.value })}
            placeholder="https://matrix.example.com"
          />
          {isDiscoveringHomeserver && (
            <p className="settings-note">Discovering homeserver…</p>
          )}
        </label>

        <label>
          Access Token
          <input
            value={draft.accessToken}
            onChange={(e) => onDraftChange({ ...draft, accessToken: e.target.value })}
            placeholder="syt_xxx"
            type="password"
          />
        </label>

        <label>
          User ID
          <input
            value={draft.userId}
            onChange={(e) => onDraftChange({ ...draft, userId: e.target.value })}
            placeholder="@user:matrix.example.com"
          />
        </label>

        {displayDeviceId && (
          <p className="settings-note" aria-label="Current device ID">
            Device ID: {displayDeviceId}
          </p>
        )}

        <label className="settings-checkbox" htmlFor="remember-credentials">
          <input
            id="remember-credentials"
            checked={draft.rememberCredentials}
            onChange={(e) => onDraftChange({ ...draft, rememberCredentials: e.target.checked })}
            type="checkbox"
          />
          <span>Remember credentials on this device</span>
        </label>

        <p className="settings-note" aria-label="Message retention policy">
          {retentionLabel}
        </p>
        <p className="settings-note" aria-label="Credential storage policy">
          Credentials are stored for this session by default. Enable remember to persist across app
          restarts.
        </p>
      </section>

      <section>
        <h4>Password Login</h4>

        <label>
          Login type
          <select
            value={loginType}
            onChange={(e) => setLoginType(e.target.value as LoginType)}
          >
            <option value="username">Username / Matrix ID</option>
            <option value="email">Email address</option>
          </select>
        </label>

        <label>
          {loginType === 'email' ? 'Email address' : 'Username or Matrix ID'}
          <input
            value={loginUsername}
            onChange={(e) => setLoginUsername(e.target.value)}
            onBlur={handleUsernameBlur}
            placeholder={
              loginType === 'email' ? 'alice@example.com' : 'alice or @alice:matrix.org'
            }
            type={loginType === 'email' ? 'email' : 'text'}
            autoComplete={loginType === 'email' ? 'email' : 'username'}
          />
        </label>

        <label>
          Password
          <input
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            placeholder="Your Matrix account password"
            type="password"
            autoComplete="current-password"
          />
        </label>

        {loginError && (
          <p className="settings-note settings-note--error" aria-live="polite">
            {loginError}
          </p>
        )}

        <div className="settings-actions-row">
          <Tooltip label="Use your Matrix credentials to obtain a fresh token and device binding">
            <button
              className="settings-btn"
              onClick={handleLoginClick}
              disabled={isBusy}
            >
              {loginButtonLabel}
            </button>
          </Tooltip>
          <p className="settings-note">
            This uses the Matrix password login API and stores the resulting access token locally.
          </p>
        </div>
      </section>
    </>
  );
}
