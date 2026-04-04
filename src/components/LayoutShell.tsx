import { useEffect, useMemo, useState } from 'react';
import { Bell, Hash, House, Info, Lock, Paperclip, Pin, Search, Send, Settings, Smile, Users, X } from 'lucide-react';
import { FormattedMessage } from './FormattedMessage';
import { Tooltip } from './Tooltip';
import { IncomingVerificationBanner } from '../features/encryption/IncomingVerificationBanner';
import {
  getRoomCryptoHealth,
  getRoomCryptoHealthLabel,
  type RoomCryptoHealth,
} from '../state/roomCryptoHealth';
import type { ConnectionState, RoomMember, RoomSummary, TimelineMessage } from '../matrix/types';
import type { VerificationSasData, VerificationSessionStatus } from '../matrix/matrixCryptoService';

type LayoutShellProps = {
  rooms: RoomSummary[];
  messages: TimelineMessage[];
  selectedRoomId: string;
  selectedRoomName: string;
  selectedRoomTopic: string;
  selectedRoomEncrypted: boolean;
  selectedRoomMembers: RoomMember[];
  selectedRoomTyping: string[];
  connectionState: ConnectionState;
  connectionError: string;
  onSelectRoom: (roomId: string) => void;
  onSendMessage: (content: string) => Promise<void>;
  onOpenSettings: () => void;
  onOpenRoomSettings: () => void;
  onSetTyping: (typing: boolean) => void;
  isSendingMessage: boolean;
  isMemberPanelOpen: boolean;
  rightPanelMode: 'members' | 'info';
  onCloseRightPanel: () => void;
  onToggleMemberPanel: () => void;
  onToggleRoomInfoPanel: () => void;
  pendingVerificationRequest: VerificationSessionStatus | null;
  onAcceptIncomingVerification: () => Promise<VerificationSessionStatus>;
  onCancelIncomingVerification: () => Promise<VerificationSessionStatus>;
  onStartIncomingVerificationSas: () => Promise<VerificationSasData>;
  onConfirmIncomingVerificationSas: () => Promise<VerificationSessionStatus>;
  onMismatchIncomingVerificationSas: () => Promise<VerificationSessionStatus>;
};

type RoomListFilter = 'all' | 'people' | 'rooms' | 'unread';

function filterRoomsByType(rooms: RoomSummary[], roomListFilter: RoomListFilter) {
  if (roomListFilter === 'people') {
    return rooms.filter((room) => room.isDirect);
  }
  if (roomListFilter === 'rooms') {
    return rooms.filter((room) => !room.isDirect);
  }
  if (roomListFilter === 'unread') {
    return rooms.filter((room) => room.unreadCount > 0);
  }
  return rooms;
}

function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildTypingLabel(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return 'Several people are typing…';
}

function getEncryptedRecoveryHint(decryptionError?: string) {
  if (!decryptionError) {
    return 'Import room keys or restore server backup keys to decrypt this message.';
  }

  if (decryptionError.includes('HISTORICAL_MESSAGE_BACKUP_UNCONFIGURED')) {
    return 'This device needs backup recovery. Use Restore With Recovery Key in Settings.';
  }

  if (decryptionError.includes('HISTORICAL_MESSAGE_WORKING_BACKUP')) {
    return 'A server backup exists for this account. Run backup restore and sync again.';
  }

  if (decryptionError.includes('HISTORICAL_MESSAGE_NO_KEY_BACKUP')) {
    return 'No server backup is available for this older message. Import exported keys from another client.';
  }

  if (decryptionError.includes('MEGOLM_UNKNOWN_INBOUND_SESSION_ID')) {
    return 'Key for this message is missing on this device. Restore backup keys or import exported keys.';
  }

  const normalizedError = decryptionError.toLowerCase();
  if (normalizedError.includes('sent before this device logged in') && normalizedError.includes('key backup is not working')) {
    return 'This message predates this device and server backup cannot provide the key. In current Element builds, if recovery was changed, only the newest generated key file works; older history may stay undecryptable without a prior room-key export.';
  }

  return 'Try restoring server backup keys, then import exported room keys if this message is still undecryptable.';
}

function renderMessageContent(message: TimelineMessage, authorDisplayName: string) {
  if (message.kind === 'encrypted') {
    return (
      <span className="encrypted-message">
        Encrypted message.
        {message.decryptionError ? ` ${message.decryptionError}` : ''}
        <span className="encrypted-message-hint"> {getEncryptedRecoveryHint(message.decryptionError)}</span>
      </span>
    );
  }

  if (message.kind === 'notice') {
    return message.formattedBody
      ? <em><FormattedMessage formattedBody={message.formattedBody} /></em>
      : <em>{message.content}</em>;
  }

  if (message.kind === 'emote') {
    return <span>* {authorDisplayName} {message.content}</span>;
  }

  if (message.kind === 'image') {
    if (message.mediaUrl) {
      return (
        <span>
          Image: <a href={message.mediaUrl}>{message.content}</a>
        </span>
      );
    }
    return <span>Image: {message.content}</span>;
  }

  if (message.kind === 'file') {
    if (message.mediaUrl) {
      return (
        <span>
          File: <a href={message.mediaUrl}>{message.content}</a>
        </span>
      );
    }
    return <span>File: {message.content}</span>;
  }

  if (message.kind === 'unsupported') {
    const typeLabel = message.rawType ? ` (${message.rawType})` : '';
    return <span>Unsupported message{typeLabel}: {message.content}</span>;
  }

  return message.formattedBody
    ? <FormattedMessage formattedBody={message.formattedBody} />
    : <span>{message.content}</span>;
}

export function LayoutShell({
  rooms,
  messages,
  selectedRoomId,
  selectedRoomName,
  selectedRoomTopic,
  selectedRoomEncrypted,
  selectedRoomMembers,
  selectedRoomTyping,
  connectionState,
  connectionError,
  onSelectRoom,
  onSendMessage,
  onOpenSettings,
  onOpenRoomSettings,
  onSetTyping,
  isSendingMessage,
  isMemberPanelOpen,
  rightPanelMode,
  onCloseRightPanel,
  onToggleMemberPanel,
  onToggleRoomInfoPanel,
  pendingVerificationRequest,
  onAcceptIncomingVerification,
  onCancelIncomingVerification,
  onStartIncomingVerificationSas,
  onConfirmIncomingVerificationSas,
  onMismatchIncomingVerificationSas,
}: LayoutShellProps) {
  const [composerText, setComposerText] = useState('');
  const [roomListFilter, setRoomListFilter] = useState<RoomListFilter>('all');

  const displayNameByUserId = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of selectedRoomMembers) {
      map.set(member.userId, member.displayName);
    }
    return map;
  }, [selectedRoomMembers]);

  const roomCryptoHealthById = useMemo(() => {
    const healthByRoomId = new Map<string, RoomCryptoHealth>();
    for (const room of rooms) {
      healthByRoomId.set(room.id, getRoomCryptoHealth(room, messages));
    }
    return healthByRoomId;
  }, [messages, rooms]);

  const selectedRoomCryptoHealth = useMemo(
    () => roomCryptoHealthById.get(selectedRoomId) ?? 'none',
    [roomCryptoHealthById, selectedRoomId],
  );

  const filteredRooms = useMemo(() => {
    return filterRoomsByType(rooms, roomListFilter);
  }, [roomListFilter, rooms]);

  const filterCounts = useMemo(
    () => ({
      all: rooms.length,
      people: rooms.filter((room) => room.isDirect).length,
      rooms: rooms.filter((room) => !room.isDirect).length,
      unread: rooms.filter((room) => room.unreadCount > 0).length,
    }),
    [rooms],
  );

  const unreadTotal = useMemo(
    () => rooms.reduce((total, room) => total + room.unreadCount, 0),
    [rooms],
  );

  useEffect(() => {
    setComposerText('');
  }, [selectedRoomId]);

  const handleSend = () => {
    const nextMessage = composerText.trim();
    if (!nextMessage) {
      return;
    }

    setComposerText('');
    onSetTyping(false);
    void onSendMessage(nextMessage).catch(() => {
      setComposerText(nextMessage);
    });
  };

  const selectRailFilter = (filter: RoomListFilter) => {
    setRoomListFilter(filter);
    const nextRooms = filterRoomsByType(rooms, filter);
    if (nextRooms.length === 0) {
      return;
    }
    const selectedRoomStillVisible = nextRooms.some((room) => room.id === selectedRoomId);
    if (!selectedRoomStillVisible) {
      onSelectRoom(nextRooms[0].id);
    }
  };

  return (
    <div className={`app-shell ${isMemberPanelOpen ? 'app-shell--members-open' : 'app-shell--members-hidden'}`}>
      <aside className="server-rail" aria-label="Servers">
        <Tooltip label={`Home (${filterCounts.all})`}>
          <button
            className={`rail-btn rail-btn--space ${roomListFilter === 'all' ? 'rail-btn--active' : ''}`}
            aria-label="Show all rooms"
            onClick={() => selectRailFilter('all')}
          >
            <House size={18} aria-hidden="true" />
          </button>
        </Tooltip>
        <Tooltip label={`People (${filterCounts.people})`}>
          <button
            className={`rail-btn rail-btn--space ${roomListFilter === 'people' ? 'rail-btn--active' : ''}`}
            aria-label="Show direct messages"
            onClick={() => selectRailFilter('people')}
          >
            <Users size={18} aria-hidden="true" />
          </button>
        </Tooltip>
        <Tooltip label={`Rooms (${filterCounts.rooms})`}>
          <button
            className={`rail-btn rail-btn--space ${roomListFilter === 'rooms' ? 'rail-btn--active' : ''}`}
            aria-label="Show group rooms"
            onClick={() => selectRailFilter('rooms')}
          >
            <Hash size={18} aria-hidden="true" />
          </button>
        </Tooltip>
        <Tooltip label={`Unread (${filterCounts.unread})`}>
          <button
            className={`rail-btn rail-btn--space ${roomListFilter === 'unread' ? 'rail-btn--active' : ''}`}
            aria-label="Show unread rooms"
            onClick={() => selectRailFilter('unread')}
          >
            <Bell size={18} aria-hidden="true" />
            {unreadTotal > 0 && <span className="rail-btn-badge">{Math.min(unreadTotal, 99)}</span>}
          </button>
        </Tooltip>
      </aside>

      <aside className="room-sidebar" aria-label="Room list">
        <header className="sidebar-header">
          <h2>Sinnamon Dev</h2>
          <Tooltip label="Settings">
            <button className="icon-btn" aria-label="Open settings" onClick={onOpenSettings}>
              <Settings size={18} aria-hidden="true" />
            </button>
          </Tooltip>
        </header>
        <div className={`connection-state connection-state--${connectionState}`}>
          <span className="connection-dot" />
          <span>
            {connectionState === 'connected' && 'Connected'}
            {connectionState === 'connecting' && 'Connecting'}
            {connectionState === 'mock' && 'Mock Mode'}
            {connectionState === 'error' && 'Connection Error'}
          </span>
        </div>
        <nav className="room-list" aria-label="Channels">
          {filteredRooms.map((room) => (
            <Tooltip
              key={room.id}
              label={`Open #${room.name}${room.isEncrypted ? ` (encrypted, ${getRoomCryptoHealthLabel(roomCryptoHealthById.get(room.id) ?? 'none') || 'status unknown'})` : ''}`}
            >
              <button
                className={`room-btn ${selectedRoomId === room.id ? 'room-btn--active' : ''}`}
                aria-label={`Room ${room.name}`}
                onClick={() => onSelectRoom(room.id)}
              >
                <span className="room-prefix">#</span>
                <span className="room-name">{room.name}</span>
                {room.isEncrypted && <span className="room-lock" aria-hidden="true"><Lock size={11} aria-hidden="true" /></span>}
                {room.isEncrypted && roomCryptoHealthById.get(room.id) !== 'none' && (
                  <span
                    className={`room-crypto-badge room-crypto-badge--${roomCryptoHealthById.get(room.id)}`}
                    aria-label={`Crypto status: ${getRoomCryptoHealthLabel(roomCryptoHealthById.get(room.id) ?? 'none')}`}
                  >
                    {getRoomCryptoHealthLabel(roomCryptoHealthById.get(room.id) ?? 'none')}
                  </span>
                )}
                {room.unreadCount > 0 && <span className="room-unread">{room.unreadCount}</span>}
              </button>
            </Tooltip>
          ))}
          {filteredRooms.length === 0 && (
            <p className="room-list-empty">No rooms in this filter.</p>
          )}
        </nav>
      </aside>

      <main className="chat-main" aria-label="Chat timeline">
        <header className="chat-header">
          <div className="chat-title-wrap">
            <div className="chat-title-row">
              <span className="chat-title">
                # {selectedRoomName}
                {selectedRoomEncrypted && <span className="chat-room-lock" aria-label="Encrypted room"><Lock size={14} aria-hidden="true" /></span>}
              </span>
              {selectedRoomEncrypted && selectedRoomCryptoHealth !== 'none' && (
                <span
                  className={`chat-crypto-status chat-crypto-status--${selectedRoomCryptoHealth}`}
                  aria-label={`Room crypto status: ${getRoomCryptoHealthLabel(selectedRoomCryptoHealth)}`}
                >
                  {getRoomCryptoHealthLabel(selectedRoomCryptoHealth)}
                </span>
              )}
            </div>
            {selectedRoomTopic && (
              <span className="chat-topic">{selectedRoomTopic}</span>
            )}
          </div>
          <div className="chat-actions">
            <Tooltip label="Room Info">
              <button
                className="icon-btn"
                aria-label="Toggle room info"
                onClick={onToggleRoomInfoPanel}
                aria-pressed={isMemberPanelOpen && rightPanelMode === 'info'}
              >
                <Info size={18} aria-hidden="true" />
              </button>
            </Tooltip>
            <Tooltip label="Search Messages">
              <button className="icon-btn" aria-label="Search messages">
                <Search size={18} aria-hidden="true" />
              </button>
            </Tooltip>
            <Tooltip label="Pinned Messages">
              <button className="icon-btn" aria-label="Pinned messages">
                <Pin size={18} aria-hidden="true" />
              </button>
            </Tooltip>
            <Tooltip label="Member List">
              <button
                className="icon-btn"
                aria-label="Toggle member list"
                onClick={onToggleMemberPanel}
                aria-pressed={isMemberPanelOpen && rightPanelMode === 'members'}
              >
                <Users size={18} aria-hidden="true" />
              </button>
            </Tooltip>
          </div>
        </header>

        <section className="timeline" aria-label="Messages">
          {pendingVerificationRequest && (
            <IncomingVerificationBanner
              request={pendingVerificationRequest}
              onAccept={onAcceptIncomingVerification}
              onCancel={onCancelIncomingVerification}
              onStartSas={onStartIncomingVerificationSas}
              onConfirm={onConfirmIncomingVerificationSas}
              onMismatch={onMismatchIncomingVerificationSas}
            />
          )}

          {messages.length > 0 ? (
            messages.map((message) => {
              const authorDisplayName = displayNameByUserId.get(message.author) ?? message.author;
              return (
                <article key={message.id} className="message-row">
                  <div className="avatar" aria-hidden="true">
                    {authorDisplayName[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="message-body">
                    <div className="message-meta">
                      <strong>{authorDisplayName}</strong>
                      {message.isEncrypted && <span className="message-encryption-pill">Encrypted</span>}
                      <span>{formatTimestamp(message.timestamp)}</span>
                    </div>
                    <p>{renderMessageContent(message, authorDisplayName)}</p>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="timeline-empty">
              <p>No timeline messages for this room yet.</p>
              {connectionError && <small>{connectionError}</small>}
            </div>
          )}
        </section>

        <div className="chat-bottom-dock">
          {selectedRoomTyping.length > 0 && (
            <div className="typing-indicator" aria-live="polite" aria-atomic="true">
              <span className="typing-dots">
                <span /><span /><span />
              </span>
              <span>{buildTypingLabel(selectedRoomTyping)}</span>
            </div>
          )}
          <footer className="composer-wrap">
            <label htmlFor="composer" className="sr-only">
              Message composer
            </label>
            <div className="composer">
              <Tooltip label="Upload File">
                <button className="icon-btn" aria-label="Upload file">
                  <Paperclip size={18} aria-hidden="true" />
                </button>
              </Tooltip>
              <input
                id="composer"
                placeholder={`Message #${selectedRoomName}`}
                value={composerText}
                onChange={(event) => {
                  setComposerText(event.target.value);
                  onSetTyping(event.target.value.length !== 0);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    handleSend();
                  }
                }}
                onBlur={() => onSetTyping(false)}
              />
              <Tooltip label="Insert Emoji">
                <button className="icon-btn" aria-label="Insert emoji">
                  <Smile size={18} aria-hidden="true" />
                </button>
              </Tooltip>
              <Tooltip label="Send Message">
                <button
                  className="icon-btn composer-send-btn"
                  aria-label="Send message"
                  onClick={handleSend}
                  disabled={isSendingMessage || composerText.trim().length === 0}
                >
                  <Send size={18} aria-hidden="true" />
                </button>
              </Tooltip>
            </div>
          </footer>
        </div>
      </main>

      {isMemberPanelOpen && (
        <aside className="member-panel" aria-label={rightPanelMode === 'members' ? 'Member panel' : 'Room info panel'}>
          <header className="member-panel-header">
            <h3>
              {rightPanelMode === 'members'
                ? `Members (${selectedRoomMembers.length})`
                : 'Room Info'}
            </h3>
            <Tooltip label={rightPanelMode === 'members' ? 'Close Member List' : 'Close Room Info'}>
              <button
                className="icon-btn member-panel-close-btn"
                aria-label={rightPanelMode === 'members' ? 'Close member list' : 'Close room info'}
                onClick={onCloseRightPanel}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </Tooltip>
          </header>
          {rightPanelMode === 'members' ? (
            selectedRoomMembers.length > 0 ? (
            <ul>
              {selectedRoomMembers.map((member) => (
                <li key={member.userId}>
                  <span className="status-dot status-dot--online" />
                  {member.displayName}
                </li>
              ))}
            </ul>
            ) : (
            <p className="member-panel-empty">No joined members found for this room.</p>
            )
          ) : (
            <div className="room-info-panel">
              <p className="room-info-name">{selectedRoomName}</p>
              <p className="room-info-meta">#{selectedRoomName.replace(/^#\s*/, '')} • {selectedRoomEncrypted ? 'Encrypted' : 'Not encrypted'}</p>
              <p className="room-info-topic">{selectedRoomTopic || 'No room topic is set.'}</p>
              <button type="button" className="room-info-settings-link" onClick={onOpenRoomSettings}>
                Settings
              </button>
              <div className="room-info-divider" />
              <ul className="room-info-facts">
                <li><strong>Room ID</strong><span>{selectedRoomId}</span></li>
                <li><strong>Members</strong><span>{selectedRoomMembers.length}</span></li>
                <li><strong>History visibility</strong><span>{selectedRoomEncrypted ? 'Encrypted timeline' : 'Standard timeline'}</span></li>
              </ul>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}