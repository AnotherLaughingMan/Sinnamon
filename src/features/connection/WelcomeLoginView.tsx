import { useRef, useState } from 'react';
import { discoverHomeserverFromMxid } from '../../matrix/matrixService';
import type { MatrixConfig } from '../../matrix/types';
import type { LoginType } from './ConnectionSettingsSection';
import { mapLoginError } from './ConnectionSettingsSection';

type WelcomeLoginViewProps = {
  draft: MatrixConfig;
  connectionState: 'mock' | 'connecting' | 'connected' | 'error';
  onDraftChange: (next: MatrixConfig) => void;
  onLogin: (request: {
    homeserverUrl: string;
    username: string;
    password: string;
    loginType: LoginType;
    rememberCredentials: boolean;
  }) => Promise<void>;
};

export function WelcomeLoginView({ draft, connectionState, onDraftChange, onLogin }: WelcomeLoginViewProps) {
  const [loginType, setLoginType] = useState<LoginType>('username');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isDiscoveringHomeserver, setIsDiscoveringHomeserver] = useState(false);
  const discoveryAbortRef = useRef<AbortController | null>(null);

  const isSyncing = connectionState === 'connecting';
  const isBusy = isLoggingIn || isSyncing;
  const loginButtonLabel = isLoggingIn ? 'Logging In...' : isSyncing ? 'Syncing...' : 'Log In';

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
      // Keep current homeserver when autodiscovery fails.
    } finally {
      if (!controller.signal.aborted) {
        setIsDiscoveringHomeserver(false);
      }
    }
  };

  const handleLogin = async () => {
    if (!draft.homeserverUrl.trim() || !loginUsername.trim() || !loginPassword.trim()) {
      setLoginError('Enter homeserver URL, username, and password to continue.');
      return;
    }

    setLoginError('');
    setIsLoggingIn(true);
    try {
      await onLogin({
        homeserverUrl: draft.homeserverUrl,
        username: loginUsername,
        password: loginPassword,
        loginType,
        rememberCredentials: draft.rememberCredentials,
      });
      setLoginPassword('');
    } catch (error) {
      setLoginError(mapLoginError(error));
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <main className="welcome-login" aria-label="Welcome login">
      <section className="welcome-login__card">
        <p className="welcome-login__eyebrow">Sinnamon</p>
        <h1 className="welcome-login__title">Welcome back</h1>
        <p className="welcome-login__subtitle">
          Sign in with your Matrix account to load rooms, encryption state, and device trust.
        </p>

        <label>
          Homeserver URL
          <input
            value={draft.homeserverUrl}
            onChange={(event) => onDraftChange({ ...draft, homeserverUrl: event.target.value })}
            placeholder="https://matrix.example.com"
            autoComplete="url"
          />
        </label>

        <label>
          Login type
          <select value={loginType} onChange={(event) => setLoginType(event.target.value as LoginType)}>
            <option value="username">Username / Matrix ID</option>
            <option value="email">Email address</option>
          </select>
        </label>

        <label>
          {loginType === 'email' ? 'Email address' : 'Username or Matrix ID'}
          <input
            value={loginUsername}
            onChange={(event) => setLoginUsername(event.target.value)}
            onBlur={handleUsernameBlur}
            placeholder={loginType === 'email' ? 'alice@example.com' : 'alice or @alice:matrix.org'}
            type={loginType === 'email' ? 'email' : 'text'}
            autoComplete={loginType === 'email' ? 'email' : 'username'}
          />
          {isDiscoveringHomeserver && <p className="settings-note">Discovering homeserver...</p>}
        </label>

        <label>
          Password
          <input
            value={loginPassword}
            onChange={(event) => setLoginPassword(event.target.value)}
            placeholder="Your Matrix account password"
            type="password"
            autoComplete="current-password"
          />
        </label>

        <label className="settings-checkbox" htmlFor="welcome-remember-credentials">
          <input
            id="welcome-remember-credentials"
            checked={draft.rememberCredentials}
            onChange={(event) => onDraftChange({ ...draft, rememberCredentials: event.target.checked })}
            type="checkbox"
          />
          <span>Remember credentials on this device</span>
        </label>

        {loginError && (
          <p className="settings-note settings-note--error" aria-live="polite">
            {loginError}
          </p>
        )}

        <div className="welcome-login__actions">
          <button className="settings-btn" onClick={handleLogin} disabled={isBusy}>
            {loginButtonLabel}
          </button>
          <p className="settings-note">
            This uses the Matrix password login API and stores the resulting access token locally.
          </p>
        </div>
      </section>
    </main>
  );
}
