import { forwardRef, useRef, useState, type CSSProperties, type ForwardedRef } from 'react';
import type { Chat } from '../api/types';
import { cordFor } from '../lib/cords';
import { chatTitle, otherMember, presenceText } from '../lib/format';
import { useChat } from '../state/ChatProvider';
import type { ThreadMessage } from '../state/store';
import { Avatar } from './Avatar';
import { Composer, type ComposerMode } from './Composer';
import { MessageList } from './MessageList';
import { MessageSearch } from './MessageSearch';
import { focusMessage } from '../lib/focusMessage';

interface LineProps {
  onBack(): void;
  onOpenDetails(chatId: string): void;
  onOpenImage(url: string): void;
  onNewLine(): void;
}

const groupPresence = (chat: Chat, meId: string, onlineIds: Set<string>): string => {
  const online = chat.participants.filter((id) => id !== meId && onlineIds.has(id)).length;
  return `${chat.participants.length} members · ${online} online`;
};

export const Line = forwardRef<HTMLSpanElement, LineProps>((props, socketRef) => {
  const { state } = useChat();
  return <LineView key={state.activeChatId ?? 'idle'} {...props} socketRef={socketRef} />;
});

Line.displayName = 'Line';

const LineView = ({
  onBack,
  onOpenDetails,
  onOpenImage,
  onNewLine,
  socketRef,
}: LineProps & { socketRef: ForwardedRef<HTMLSpanElement> }) => {
  const { state, actions } = useChat();
  const [mode, setMode] = useState<ComposerMode>({ kind: 'new' });
  const [searching, setSearching] = useState(false);
  const lineRef = useRef<HTMLElement>(null);
  const chat = state.activeChatId ? state.chats[state.activeChatId] : undefined;
  const thread = chat ? state.threads[chat.id] : undefined;

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
      ref={lineRef}
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
        <div className="line-actions">
          <button
            type="button"
            className="key key-ghost"
            aria-pressed={searching}
            onClick={() => setSearching(!searching)}
          >
            Search
          </button>
          <button type="button" className="key key-ghost" onClick={() => onOpenDetails(chat.id)}>
            Details
          </button>
        </div>
      </header>
      {searching && (
        <MessageSearch
          chatId={chat.id}
          onClose={() => setSearching(false)}
          onSelect={async (messageId) => {
            if (await actions.revealMessage(chat.id, messageId)) {
              requestAnimationFrame(() => focusMessage(lineRef.current, messageId));
            }
          }}
        />
      )}
      <MessageList
        chat={chat}
        thread={thread}
        typingUserIds={typingUserIds}
        firstUnreadId={thread?.firstUnreadId ?? null}
        onOpenImage={onOpenImage}
        onReply={(message: ThreadMessage) => setMode({ kind: 'reply', message })}
        onEdit={(message: ThreadMessage) => setMode({ kind: 'edit', message })}
      />
      <Composer
        key={mode.kind === 'edit' ? `edit-${mode.message.id}` : 'compose'}
        chatId={chat.id}
        mode={mode}
        onModeDone={() => setMode({ kind: 'new' })}
      />
    </main>
  );
};
