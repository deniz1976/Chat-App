import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { Chat, User } from '../api/types';
import { formatDay, formatTime, isSameDay } from '../lib/format';
import { useChat } from '../state/ChatProvider';
import type { Thread, ThreadMessage } from '../state/store';
import { Avatar } from './Avatar';

const GROUP_WINDOW_MS = 5 * 60 * 1000;
const STICK_TO_BOTTOM_PX = 120;
const IMAGE_FILE_NAME = /\.(png|jpe?g|gif|webp)$/i;

interface MessageListProps {
  chat: Chat;
  thread: Thread | undefined;
  typingUserIds: string[];
  onOpenImage(url: string): void;
}

const isContinuation = (message: ThreadMessage, previous: ThreadMessage | undefined): boolean =>
  !!previous &&
  previous.senderId === message.senderId &&
  isSameDay(previous.createdAt, message.createdAt) &&
  new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() < GROUP_WINDOW_MS;

const deliveryText = (message: ThreadMessage, chat: Chat, meId: string): string => {
  const readers = message.readBy.filter((id) => id !== meId).length;
  if (readers === 0) {
    return 'Sent';
  }
  return chat.type === 'group' ? `Read by ${readers}` : 'Read';
};

export const MessageList = ({ chat, thread, typingUserIds, onOpenImage }: MessageListProps) => {
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
  const senderOf = (message: ThreadMessage): Pick<User, 'displayName' | 'profileImage'> =>
    state.users[message.senderId] ?? message.sender ?? { displayName: 'Unknown', profileImage: null };

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
        const mine = message.senderId === meId;
        const continued = isContinuation(message, previous);
        const newDay = !previous || !isSameDay(previous.createdAt, message.createdAt);
        const sender = senderOf(message);
        const caption = message.type === 'image' && IMAGE_FILE_NAME.test(message.content) ? '' : message.content;

        return (
          <div key={message.id} style={{ display: 'contents' }}>
            {newDay && <div className="day-rule">{formatDay(message.createdAt)}</div>}
            <div
              className={`msg${mine ? ' msg-mine' : ''}${continued && !newDay ? ' continued' : ''}${
                message.localStatus === 'sending' ? ' sending' : ''
              }`}
            >
              {!mine &&
                (continued && !newDay ? (
                  <span />
                ) : (
                  <Avatar name={sender.displayName} src={sender.profileImage} size={32} />
                ))}
              <div className="msg-body">
                {!mine && chat.type === 'group' && !(continued && !newDay) && (
                  <span className="plate msg-sender">{sender.displayName}</span>
                )}
                {message.type === 'image' && message.mediaUrl && (
                  <button type="button" className="msg-image" onClick={() => onOpenImage(message.mediaUrl!)}>
                    <img src={message.mediaUrl} alt={caption || 'Shared image'} loading="lazy" />
                  </button>
                )}
                {caption && (
                  <p className="msg-card" style={{ margin: 0 }}>
                    {caption}
                  </p>
                )}
                <span className={`msg-meta${message.localStatus === 'failed' ? ' failed' : ''}`}>
                  <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
                  {mine && message.localStatus === 'sending' && <span>Sending</span>}
                  {mine && message.localStatus === 'failed' && (
                    <>
                      <span>Not sent</span>
                      <button type="button" onClick={() => actions.retry(message)}>
                        Retry
                      </button>
                      <button type="button" onClick={() => actions.discard(message)}>
                        Discard
                      </button>
                    </>
                  )}
                  {mine && !message.localStatus && <span>{deliveryText(message, chat, meId)}</span>}
                </span>
              </div>
            </div>
          </div>
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
