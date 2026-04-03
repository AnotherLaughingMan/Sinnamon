import { useEffect, useMemo, useState } from 'react';
import { LayoutShell } from './components/LayoutShell';
import { SettingsPanel } from './components/SettingsPanel';
import type { MatrixConfig } from './matrix/types';
import { useMatrixViewState } from './state/useMatrixViewState';

const SETTINGS_KEY = 'sinnamon-matrix-config';

const EMPTY_CONFIG: MatrixConfig = {
  homeserverUrl: '',
  accessToken: '',
  userId: '',
  rememberCredentials: false,
};

function normalizeConfig(value: Partial<MatrixConfig>) {
  return {
    homeserverUrl: value.homeserverUrl ?? '',
    accessToken: value.accessToken ?? '',
    userId: value.userId ?? '',
    rememberCredentials: Boolean(value.rememberCredentials),
  } satisfies MatrixConfig;
}

function readStoredConfig(storage: Storage) {
  const rawValue = storage.getItem(SETTINGS_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<MatrixConfig>;
    return normalizeConfig(parsed);
  } catch {
    return null;
  }
}

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [config, setConfig] = useState<MatrixConfig>(() => {
    const localConfig = readStoredConfig(localStorage);
    if (localConfig) {
      return { ...localConfig, rememberCredentials: true };
    }

    const sessionConfig = readStoredConfig(sessionStorage);
    if (sessionConfig) {
      return { ...sessionConfig, rememberCredentials: false };
    }

    return EMPTY_CONFIG;
  });

  const {
    rooms,
    roomMessages,
    selectedRoomId,
    selectedRoom,
    connectionState,
    error,
    connect,
    sendMessage,
    selectRoom,
    isSendingMessage,
  } = useMatrixViewState(config);

  useEffect(() => {
    const serializedConfig = JSON.stringify(config);

    if (config.rememberCredentials) {
      localStorage.setItem(SETTINGS_KEY, serializedConfig);
      sessionStorage.removeItem(SETTINGS_KEY);
      return;
    }

    sessionStorage.setItem(SETTINGS_KEY, serializedConfig);
    localStorage.removeItem(SETTINGS_KEY);
  }, [config]);

  const selectedRoomName = useMemo(() => selectedRoom?.name ?? 'general', [selectedRoom?.name]);

  return (
    <>
      <LayoutShell
        rooms={rooms}
        messages={roomMessages}
        selectedRoomId={selectedRoomId}
        selectedRoomName={selectedRoomName}
        connectionState={connectionState}
        connectionError={error}
        onSelectRoom={selectRoom}
        onSendMessage={sendMessage}
        isSendingMessage={isSendingMessage}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
      <SettingsPanel
        initialValue={config}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={(nextConfig) => setConfig(nextConfig)}
        onConnect={(nextConfig) => connect(nextConfig)}
      />
    </>
  );
}

export default App;