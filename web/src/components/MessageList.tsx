import { Fragment, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { Chat, MessageSender, User } from '../api/types';
import { formatDay, isSameDay } from '../lib/format';
import { useChat } from '../state/ChatProvider';
import type { Thread, ThreadMessage } from '../state/store';
import { focusMessage } from '../lib/focusMessage';
import { MessageItem } from './MessageItem';

const GROUP_WINDOW_MS = 5 * 60 * 1000;
const STICK_TO_BOTTOM_PX = 120;

interface MessageListProps {
  chat: Chat;
  thread: Thread | undefined;
  typingUserIds: string[];
  firstUnreadId: string | null;
  onOpenImage(url: string): void;
  onReply(message: ThreadMessage): void;
  onEdit(message: ThreadMessage): void;
}

const isContinuation = (message: ThreadMessage, previous: ThreadMessage | undefined): boolean =>
  !!previous &&
  previous.senderId === message.senderId &&
  isSameDay(previous.createdAt, message.createdAt) &&
  new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() < GROUP_WINDOW_MS;

export const MessageList = ({
  chat,
  thread,
  typingUserIds,
  firstUnreadId,
  onOpenImage,
  onReply,
  onEdit,
}: MessageListProps) => {
  const { state, actions } = useChat();
  const meId = state.me.id;
  const container = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const previousHeight = useRef(0);
  const firstId = useRef<string | undefined>(undefined);
  const lastId = useRef<string | undefined>(undefined);
  const items = useMemo(() => thread?.items ?? [], [thread?.items]);

  useLayoutEffect(() => {
    const element = container.current;
    if (!element) {
      return;
    }
    const newFirst = items[0]?.id;
    const newLast = items[items.length - 1];
    const prependedOlder =
      firstId.current !== undefined && newFirst !== firstId.current && newLast?.id === lastId.current;
    const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < STICK_TO_BOTTOM_PX + 200;

    if (prependedOlder) {
      element.scrollTop += element.scrollHeight - previousHeight.current;
    } else if (lastId.current === undefined || newLast?.senderId === meId || nearBottom) {
      element.scrollTop = element.scrollHeight;
    }

    firstId.current = newFirst;
    lastId.current = newLast?.id;
    previousHeight.current = element.scrollHeight;
  }, [items, meId]);

  useEffect(() => {
    firstId.current = undefined;
    lastId.current = undefined;
  }, [chat.id]);

  useEffect(() => {
    const target = sentinel.current;
    if (!target || !thread?.hasMore) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          void actions.loadOlder(chat.id);
        }
      },
      { root: container.current, rootMargin: '200px 0px 0px 0px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [actions, chat.id, thread?.hasMore, thread?.loaded]);

  const typingNames = typingUserIds.map((id) => state.users[id]?.displayName.split(' ')[0]).filter(Boolean);
  const senderOf = (senderId: string, fallback?: MessageSender): Pick<User, 'displayName' | 'profileImage'> =>
    state.users[senderId] ?? fallback ?? { displayName: 'Unknown', profileImage: null };

  const jumpTo = (messageId: string) => {
    focusMessage(container.current, messageId);
  };

  return (
    <div className="messages" ref={container} role="log" aria-label="Messages" aria-live="polite">
      <div ref={sentinel} />
      {thread?.loading && <span className="messages-status label">Loading…</span>}
      {thread?.loaded && !thread.hasMore && items.length > 0 && (
        <span className="messages-status label">Start of the conversation</span>
      )}
      {thread?.loaded && items.length === 0 && (
        <span className="messages-status label">No messages yet. Say hello.</span>
      )}

      {items.map((message, index) => {
        const previous = items[index - 1];
        const newDay = !previous || !isSameDay(previous.createdAt, message.createdAt);
        return (
          <Fragment key={message.id}>
            {newDay && <div className="day-rule">{formatDay(message.createdAt)}</div>}
            {message.id === firstUnreadId && <div className="unread-rule">New messages</div>}
            <MessageItem
              message={message}
              chat={chat}
              sender={senderOf(message.senderId, message.sender)}
              replySender={message.replyTo ? senderOf(message.replyTo.senderId) : undefined}
              mine={message.senderId === meId}
              continued={!newDay && message.id !== firstUnreadId && isContinuation(message, previous)}
              onReply={onReply}
              onEdit={onEdit}
              onOpenImage={onOpenImage}
              onJumpTo={jumpTo}
            />
          </Fragment>
        );
      })}

      <div className="typing-row" aria-live="polite">
        {typingNames.length > 0 && (
          <>
            <span className="lamp lamp-online lamp-blink" aria-hidden="true" />
            <span className="label">
              {typingNames.join(', ')} {typingNames.length > 1 ? 'are' : 'is'} typing
            </span>
          </>
        )}
      </div>
    </div>
  );
};
