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
};

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [config, setConfig] = useState<MatrixConfig>(() => {
    const storedValue = localStorage.getItem(SETTINGS_KEY);
    if (!storedValue) {
      return EMPTY_CONFIG;
    }

    try {
      return JSON.parse(storedValue) as MatrixConfig;
    } catch {
      return EMPTY_CONFIG;
    }
  });

  const { rooms, roomMessages, selectedRoomId, selectedRoom, connectionState, error, connect, selectRoom } =
    useMatrixViewState(config);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(config));
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