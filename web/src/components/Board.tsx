import { forwardRef, useState } from 'react';
import type { ThemePreference } from '../lib/theme';
import { chatTitle } from '../lib/format';
import { useChat } from '../state/ChatProvider';
import { sortedChats } from '../state/store';
import { Avatar } from './Avatar';
import { JackRow } from './JackRow';

interface BoardProps {
  theme: ThemePreference;
  onThemeChange(theme: ThemePreference): void;
  onNewLine(): void;
  onOpenProfile(): void;
}

const THEMES: Array<{ value: ThemePreference; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'day', label: 'Day' },
  { value: 'night', label: 'Night' },
];

export const Board = forwardRef<HTMLSpanElement, BoardProps>(
  ({ theme, onThemeChange, onNewLine, onOpenProfile }, socketRef) => {
    const { state, actions } = useChat();
    const [filter, setFilter] = useState('');
    const me = state.users[state.me.id] ?? state.me;
    const query = filter.trim().toLowerCase();
    const chats = sortedChats(state).filter(
      (chat) => !query || chatTitle(chat, me.id, state.users).toLowerCase().includes(query),
    );

    return (
      <aside className="board" aria-label="Conversations">
        <div className="me">
          <button type="button" className="me-button" onClick={onOpenProfile} aria-label="Open your profile">
            <Avatar
              name={me.displayName}
              src={me.profileImage}
              size={44}
              status={me.status === 'away' ? 'away' : 'online'}
            />
            <span style={{ minWidth: 0 }}>
              <span className="me-name">{me.displayName}</span>
              <span className="label">@{me.username}</span>
            </span>
          </button>
          <div className="status-switch" role="group" aria-label="Your status">
            <button type="button" aria-pressed={me.status !== 'away'} onClick={() => void actions.setStatus('online')}>
              Online
            </button>
            <button type="button" aria-pressed={me.status === 'away'} onClick={() => void actions.setStatus('away')}>
              Away
            </button>
          </div>
        </div>

        <label className="dial">
          <b aria-hidden="true">DIAL</b>
          <span className="sr-only">Filter conversations</span>
          <input
            id="chat-filter"
            type="search"
            placeholder="Filter lines"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
        </label>

        {chats.length > 0 ? (
          <ul className="jacks">
            {chats.map((chat) => (
              <JackRow
                key={chat.id}
                ref={socketRef}
                chat={chat}
                meId={me.id}
                users={state.users}
                typingUserIds={Object.keys(state.typing[chat.id] ?? {})}
                active={chat.id === state.activeChatId}
                onSelect={() => actions.selectChat(chat.id)}
              />
            ))}
          </ul>
        ) : (
          <div className="board-empty jacks">
            <span className="label">{query ? 'No matching lines' : 'No lines yet'}</span>
            <span>{query ? 'Try another name.' : 'Open a new line to start talking to someone.'}</span>
          </div>
        )}

        <div className="board-footer">
          <button type="button" className="key" onClick={onNewLine}>
            + New line
          </button>
          <div className="board-footer-row">
            <div className="theme-switch" role="group" aria-label="Theme">
              {THEMES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={theme === option.value}
                  onClick={() => onThemeChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <span className="connection label" role="status">
              <span
                className={`lamp ${state.connection === 'open' ? 'lamp-online' : 'lamp-blink'}`}
                aria-hidden="true"
              />
              {state.connection === 'open' ? 'Live' : 'Reconnecting'}
            </span>
          </div>
        </div>
      </aside>
    );
  },
);

Board.displayName = 'Board';
