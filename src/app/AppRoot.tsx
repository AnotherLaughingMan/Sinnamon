import { WelcomeLoginView } from '../features/connection/WelcomeLoginView';
import { PostLoginE2EEGate } from '../features/encryption/PostLoginE2EEGate';
import { requestOwnUserVerification } from '../matrix/matrixCryptoService';
import { useMatrixLifecycle } from './useMatrixLifecycle';
import { WorkspaceView } from './WorkspaceView';

export function AppRoot() {
  const lifecycle = useMatrixLifecycle();

  if (lifecycle.route === 'welcome') {
    return (
      <WelcomeLoginView
        draft={lifecycle.config}
        connectionState={lifecycle.matrixViewState.connectionState}
        onDraftChange={lifecycle.setConfig}
        onLogin={async (request) => {
          await lifecycle.loginAndConnect(request);
        }}
      />
    );
  }

  if (lifecycle.route === 'post_login_security') {
    return (
      <PostLoginE2EEGate
        config={lifecycle.config}
        onFinished={lifecycle.completePostLoginSecurityGate}
        onVerifyFromAnotherDevice={async () => {
          await requestOwnUserVerification(lifecycle.config);
        }}
        onSignOut={lifecycle.signOutToPersistedDraft}
      />
    );
  }

  return (
    <WorkspaceView
      config={lifecycle.config}
      setConfig={lifecycle.setConfig}
      matrixViewState={lifecycle.matrixViewState}
      onLogin={lifecycle.loginAndConnect}
    />
  );
}
