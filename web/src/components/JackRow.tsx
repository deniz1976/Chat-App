import { forwardRef, type CSSProperties } from 'react';
import type { Chat, User } from '../api/types';
import { cordFor } from '../lib/cords';
import { chatTitle, formatListTime, otherMember } from '../lib/format';
import { Avatar } from './Avatar';
import { summaryOf } from './MessageItem';

interface JackRowProps {
  chat: Chat;
  meId: string;
  users: Record<string, User>;
  typingUserIds: string[];
  active: boolean;
  onSelect(): void;
}

const previewText = (chat: Chat, meId: string, users: Record<string, User>): string => {
  const message = chat.lastMessage;
  if (!message) {
    return chat.type === 'group' ? `${chat.members.length} members` : 'No messages yet';
  }
  const body = summaryOf(message);
  if (message.senderId === meId) {
    return `You: ${body}`;
  }
  if (chat.type === 'group') {
    const sender = users[message.senderId];
    return `${sender?.displayName.split(' ')[0] ?? 'Someone'}: ${body}`;
  }
  return body;
};

export const JackRow = forwardRef<HTMLSpanElement, JackRowProps>(
  ({ chat, meId, users, typingUserIds, active, onSelect }, socketRef) => {
    const title = chatTitle(chat, meId, users);
    const other = chat.type === 'direct' ? otherMember(chat, meId, users) : undefined;
    const typingNames = typingUserIds.map((id) => users[id]?.displayName.split(' ')[0]).filter(Boolean);
    const cord = cordFor(chat.id);
    const timestamp = chat.lastMessage?.createdAt;

    return (
      <li>
        <button
          type="button"
          className="jack-row"
          aria-current={active}
          onClick={onSelect}
          style={{ '--cord': `var(--cord-${cord})` } as CSSProperties}
        >
          <Avatar
            name={title}
            src={chat.type === 'group' ? chat.avatar : other?.profileImage}
            square={chat.type === 'group'}
            status={other?.status}
            typing={typingNames.length > 0}
          />
          <span className="jack-title">
            <span className="plate">{title}</span>
            {timestamp && <span className="jack-time">{formatListTime(timestamp)}</span>}
          </span>
          {chat.unreadCount > 0 ? (
            <span className="jack-count" aria-label={`${chat.unreadCount} unread`}>
              {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
            </span>
          ) : (
            <span />
          )}
          <span className="jack-socket" ref={active ? socketRef : undefined} aria-hidden="true" />
          <span className={`jack-preview${typingNames.length > 0 ? ' typing' : ''}`}>
            {typingNames.length > 0
              ? chat.type === 'group'
                ? `${typingNames.join(', ')} typing…`
                : 'typing…'
              : previewText(chat, meId, users)}
          </span>
        </button>
      </li>
    );
  },
);

JackRow.displayName = 'JackRow';
