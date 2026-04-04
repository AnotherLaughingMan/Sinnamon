import { useEffect, useState } from 'react';
import { Lock, Save, Shield, Users, X } from 'lucide-react';
import { Tooltip } from './Tooltip';

type RoomSettingsDialogProps = {
  isOpen: boolean;
  roomId: string;
  roomName: string;
  roomTopic: string;
  isEncrypted: boolean;
  memberCount: number;
  onClose: () => void;
  onSave: (nextValues: RoomSettingsDraft) => void;
};

export type RoomSettingsDraft = {
  roomName: string;
  roomTopic: string;
  historyVisibility: 'joined' | 'invited' | 'world_readable';
  joinRule: 'invite' | 'public';
  guestAccess: 'forbidden' | 'can_join';
};

const DEFAULT_ROOM_SETTINGS: Pick<RoomSettingsDraft, 'historyVisibility' | 'joinRule' | 'guestAccess'> = {
  historyVisibility: 'joined',
  joinRule: 'invite',
  guestAccess: 'forbidden',
};

export function RoomSettingsDialog({
  isOpen,
  roomId,
  roomName,
  roomTopic,
  isEncrypted,
  memberCount,
  onClose,
  onSave,
}: RoomSettingsDialogProps) {
  const [draft, setDraft] = useState<RoomSettingsDraft>({
    roomName,
    roomTopic,
    ...DEFAULT_ROOM_SETTINGS,
  });

  useEffect(() => {
    setDraft({
      roomName,
      roomTopic,
      ...DEFAULT_ROOM_SETTINGS,
    });
  }, [roomName, roomTopic]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="settings-overlay" role="dialog" aria-modal="true" aria-label="Room settings">
      <div className="settings-panel settings-panel--room">
        <header>
          <div className="settings-header-copy">
            <h3>Room Settings</h3>
            <p className="settings-note">Manage room metadata and moderation defaults for this room.</p>
          </div>
          <Tooltip label="Close room settings">
            <button className="icon-btn" onClick={onClose} aria-label="Close room settings">
              <X size={18} aria-hidden="true" />
            </button>
          </Tooltip>
        </header>

        <div className="settings-content settings-content--room">
          <section>
            <h4>Room Identity</h4>
            <label>
              Room Name
              <input
                value={draft.roomName}
                onChange={(event) =>
                  setDraft((previous) => ({
                    ...previous,
                    roomName: event.target.value,
                  }))
                }
                placeholder="# general"
              />
            </label>
            <label>
              Room Topic
              <input
                value={draft.roomTopic}
                onChange={(event) =>
                  setDraft((previous) => ({
                    ...previous,
                    roomTopic: event.target.value,
                  }))
                }
                placeholder="What this room is about"
              />
            </label>
            <p className="settings-note">Room ID: {roomId || 'No room selected'}</p>
          </section>

          <section>
            <h4>Visibility & Access</h4>
            <label>
              History Visibility
              <select
                value={draft.historyVisibility}
                onChange={(event) =>
                  setDraft((previous) => ({
                    ...previous,
                    historyVisibility: event.target.value as RoomSettingsDraft['historyVisibility'],
                  }))
                }
              >
                <option value="joined">Joined Members</option>
                <option value="invited">Invited Members</option>
                <option value="world_readable">World Readable</option>
              </select>
            </label>

            <label>
              Join Rule
              <select
                value={draft.joinRule}
                onChange={(event) =>
                  setDraft((previous) => ({
                    ...previous,
                    joinRule: event.target.value as RoomSettingsDraft['joinRule'],
                  }))
                }
              >
                <option value="invite">Invite Only</option>
                <option value="public">Public</option>
              </select>
            </label>

            <label>
              Guest Access
              <select
                value={draft.guestAccess}
                onChange={(event) =>
                  setDraft((previous) => ({
                    ...previous,
                    guestAccess: event.target.value as RoomSettingsDraft['guestAccess'],
                  }))
                }
              >
                <option value="forbidden">Forbidden</option>
                <option value="can_join">Can Join</option>
              </select>
            </label>
          </section>

          <section>
            <h4>Room Snapshot</h4>
            <ul className="room-info-facts">
              <li><strong>Members</strong><span><Users size={12} aria-hidden="true" /> {memberCount}</span></li>
              <li><strong>Encryption</strong><span><Lock size={12} aria-hidden="true" /> {isEncrypted ? 'Enabled' : 'Disabled'}</span></li>
              <li><strong>Moderation Model</strong><span><Shield size={12} aria-hidden="true" /> Server-admin controlled</span></li>
            </ul>
          </section>
        </div>

        <footer>
          <Tooltip label="Save room settings for this room">
            <button
              className="settings-btn"
              onClick={() => onSave(draft)}
            >
              <Save size={15} aria-hidden="true" />
              Save Room Settings
            </button>
          </Tooltip>
        </footer>
      </div>
    </div>
  );
}
