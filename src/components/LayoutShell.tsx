import { Tooltip } from './Tooltip';
import { getRetentionSummaryLabel } from '../matrix/retention';
import type { ConnectionState, RoomSummary, TimelineMessage } from '../matrix/types';

const SERVERS = ['S', 'D', 'A', 'T'];

type LayoutShellProps = {
  rooms: RoomSummary[];
  messages: TimelineMessage[];
  selectedRoomId: string;
  selectedRoomName: string;
  connectionState: ConnectionState;
  connectionError: string;
  onSelectRoom: (roomId: string) => void;
  onOpenSettings: () => void;
};

function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function LayoutShell({
  rooms,
  messages,
  selectedRoomId,
  selectedRoomName,
  connectionState,
  connectionError,
  onSelectRoom,
  onOpenSettings,
}: LayoutShellProps) {
  const retentionLabel = getRetentionSummaryLabel();

  return (
    <div className="app-shell">
      <aside className="server-rail" aria-label="Servers">
        <Tooltip label="Home">
          <button className="rail-btn rail-btn--active" aria-label="Home server">
            H
          </button>
        </Tooltip>
        {SERVERS.map((server) => (
          <Tooltip key={server} label={`Server ${server}`}>
            <button className="rail-btn" aria-label={`Server ${server}`}>
              {server}
            </button>
          </Tooltip>
        ))}
        <Tooltip label="Add Server">
          <button className="rail-btn rail-btn--add" aria-label="Add server">
            +
          </button>
        </Tooltip>
      </aside>

      <aside className="room-sidebar" aria-label="Room list">
        <header className="sidebar-header">
          <h2>Sinnamon Dev</h2>
          <Tooltip label="Settings">
            <button className="icon-btn" aria-label="Open settings" onClick={onOpenSettings}>
              ⚙
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
          {rooms.map((room) => (
            <Tooltip key={room.id} label={`Open #${room.name}`}>
              <button
                className={`room-btn ${selectedRoomId === room.id ? 'room-btn--active' : ''}`}
                aria-label={`Room ${room.name}`}
                onClick={() => onSelectRoom(room.id)}
              >
                <span className="room-prefix">#</span>
                <span className="room-name">{room.name}</span>
                {room.unreadCount > 0 && <span className="room-unread">{room.unreadCount}</span>}
              </button>
            </Tooltip>
          ))}
        </nav>
      </aside>

      <main className="chat-main" aria-label="Chat timeline">
        <header className="chat-header">
          <div className="chat-title"># {selectedRoomName}</div>
          <div className="chat-actions">
            <Tooltip label={retentionLabel}>
              <button className="icon-btn" aria-label="Retention limits">
                ⓘ
              </button>
            </Tooltip>
            <Tooltip label="Search Messages">
              <button className="icon-btn" aria-label="Search messages">
                🔎
              </button>
            </Tooltip>
            <Tooltip label="Pinned Messages">
              <button className="icon-btn" aria-label="Pinned messages">
                📌
              </button>
            </Tooltip>
            <Tooltip label="Member List">
              <button className="icon-btn" aria-label="Toggle member list">
                👥
              </button>
            </Tooltip>
          </div>
        </header>

        <section className="timeline" aria-label="Messages">
          {messages.length > 0 ? (
            messages.map((message) => (
              <article key={message.id} className="message-row">
                <div className="avatar" aria-hidden="true">
                  {message.author[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="message-body">
                  <div className="message-meta">
                    <strong>{message.author}</strong>
                    <span>{formatTimestamp(message.timestamp)}</span>
                  </div>
                  <p>{message.content}</p>
                </div>
              </article>
            ))
          ) : (
            <div className="timeline-empty">
              <p>No timeline messages for this room yet.</p>
              {connectionError && <small>{connectionError}</small>}
            </div>
          )}
        </section>

        <footer className="composer-wrap">
          <label htmlFor="composer" className="sr-only">
            Message composer
          </label>
          <div className="composer">
            <Tooltip label="Upload File">
              <button className="icon-btn" aria-label="Upload file">
                +
              </button>
            </Tooltip>
            <input id="composer" placeholder={`Message #${selectedRoomName}`} />
            <Tooltip label="Insert Emoji">
              <button className="icon-btn" aria-label="Insert emoji">
                😀
              </button>
            </Tooltip>
            <Tooltip label="Gift Placeholder">
              <button className="icon-btn" aria-label="Gift placeholder">
                🎁
              </button>
            </Tooltip>
          </div>
        </footer>
      </main>

      <aside className="member-panel" aria-label="Member panel">
        <header>
          <h3>Members</h3>
        </header>
        <ul>
          <li>
            <span className="status-dot status-dot--online" />sinnamon-dev
          </li>
          <li>
            <span className="status-dot status-dot--idle" />matrix-bot
          </li>
          <li>
            <span className="status-dot" />guest-user
          </li>
        </ul>
      </aside>
    </div>
  );
}