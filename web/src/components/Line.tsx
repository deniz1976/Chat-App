import { forwardRef, type CSSProperties } from 'react';
import type { Chat } from '../api/types';
import { cordFor } from '../lib/cords';
import { chatTitle, otherMember, presenceText } from '../lib/format';
import { useChat } from '../state/ChatProvider';
import { Avatar } from './Avatar';
import { Composer } from './Composer';
import { MessageList } from './MessageList';

interface LineProps {
  onBack(): void;
  onOpenImage(url: string): void;
  onNewLine(): void;
}

const groupPresence = (chat: Chat, meId: string, onlineIds: Set<string>): string => {
  const online = chat.participants.filter((id) => id !== meId && onlineIds.has(id)).length;
  return `${chat.participants.length} members · ${online} online`;
};

export const Line = forwardRef<HTMLSpanElement, LineProps>(({ onBack, onOpenImage, onNewLine }, socketRef) => {
  const { state } = useChat();
  const chat = state.activeChatId ? state.chats[state.activeChatId] : undefined;

  if (!chat) {
    return (
      <main className="line">
        <div className="line-idle">
          <span className="lamp" aria-hidden="true" />
          <h2>No line connected</h2>
          <p>Pick a conversation on the board, or open a new line to someone.</p>
          <button type="button" className="key" onClick={onNewLine}>
            + New line
          </button>
        </div>
      </main>
    );
  }

  const meId = state.me.id;
  const title = chatTitle(chat, meId, state.users);
  const other = chat.type === 'direct' ? otherMember(chat, meId, state.users) : undefined;
  const typingUserIds = Object.keys(state.typing[chat.id] ?? {});
  const typingNames = typingUserIds.map((id) => state.users[id]?.displayName.split(' ')[0]).filter(Boolean);
  const onlineIds = new Set(
    Object.values(state.users)
      .filter((user) => user.status === 'online')
      .map((user) => user.id),
  );
  const cord = cordFor(chat.id);

  let presence: string;
  let presenceClass = '';
  if (typingNames.length > 0) {
    presence = chat.type === 'group' ? `${typingNames.join(', ')} typing…` : 'Typing…';
    presenceClass = 'typing';
  } else if (other) {
    presence = presenceText(other);
    presenceClass = other.status === 'online' ? 'online' : '';
  } else {
    presence = groupPresence(chat, meId, onlineIds);
  }

  return (
    <main
      className="line"
      style={{ '--cord': `var(--cord-${cord})`, '--cord-text': `var(--cord-${cord}-text)` } as CSSProperties}
      aria-label={`Conversation with ${title}`}
    >
      <header className="line-header">
        <span className="line-socket" ref={socketRef} aria-hidden="true" />
        <button type="button" className="tool line-back" onClick={onBack} aria-label="Back to conversations">
          ←
        </button>
        <Avatar
          name={title}
          src={chat.type === 'group' ? chat.avatar : other?.profileImage}
          square={chat.type === 'group'}
          size={44}
          status={other?.status}
          typing={typingNames.length > 0}
        />
        <div className="line-title">
          <h2>{title}</h2>
          <span className={`presence ${presenceClass}`}>{presence}</span>
        </div>
      </header>
      <MessageList
        chat={chat}
        thread={state.threads[chat.id]}
        typingUserIds={typingUserIds}
        onOpenImage={onOpenImage}
      />
      <Composer key={chat.id} chatId={chat.id} />
    </main>
  );
});

Line.displayName = 'Line';
