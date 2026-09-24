import { useState } from 'react';
import type { Chat, ReplySummary, User } from '../api/types';
import { formatTime } from '../lib/format';
import { useChat } from '../state/ChatProvider';
import type { ThreadMessage } from '../state/store';
import { Avatar } from './Avatar';

const IMAGE_FILE_NAME = /\.(png|jpe?g|gif|webp)$/i;

type Sender = Pick<User, 'displayName' | 'profileImage'>;

interface MessageItemProps {
  message: ThreadMessage;
  chat: Chat;
  sender: Sender;
  replySender: Sender | undefined;
  mine: boolean;
  continued: boolean;
  highlighted: boolean;
  onReply(message: ThreadMessage): void;
  onEdit(message: ThreadMessage): void;
  onOpenImage(url: string): void;
  onJumpTo(messageId: string): void;
}

const deliveryText = (message: ThreadMessage, chat: Chat): string => {
  const readers = message.readBy.filter((id) => id !== message.senderId).length;
  if (readers === 0) {
    return 'Sent';
  }
  return chat.type === 'group' ? `Read by ${readers}` : 'Read';
};

export const captionOf = (message: Pick<ThreadMessage, 'type' | 'content'>): string =>
  message.type === 'image' && IMAGE_FILE_NAME.test(message.content) ? '' : message.content;

const replyPreview = (reply: ReplySummary): string => captionOf(reply) || 'Photo';

export const MessageItem = ({
  message,
  chat,
  sender,
  replySender,
  mine,
  continued,
  highlighted,
  onReply,
  onEdit,
  onOpenImage,
  onJumpTo,
}: MessageItemProps) => {
  const { actions } = useChat();
  const [menu, setMenu] = useState<'closed' | 'open' | 'confirm-delete'>('closed');
  const [error, setError] = useState<string | null>(null);
  const caption = captionOf(message);
  const settled = !message.localStatus;

  const remove = async () => {
    try {
      await actions.deleteMessage(message);
    } catch {
      setError('Could not delete the message.');
      setMenu('closed');
    }
  };

  const classes = [
    'msg',
    mine && 'msg-mine',
    continued && 'continued',
    message.localStatus === 'sending' && 'sending',
    highlighted && 'highlighted',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} data-message-id={message.id}>
      {!mine && (continued ? <span /> : <Avatar name={sender.displayName} src={sender.profileImage} size={32} />)}
      <div className="msg-body">
        {!mine && chat.type === 'group' && !continued && <span className="plate msg-sender">{sender.displayName}</span>}

        {message.replyToId && (
          <button
            type="button"
            className="msg-quote"
            disabled={!message.replyTo}
            onClick={() => message.replyTo && onJumpTo(message.replyTo.id)}
          >
            {message.replyTo ? (
              <>
                <span className="label">{replySender?.displayName ?? 'Unknown'}</span>
                <span className="msg-quote-text">{replyPreview(message.replyTo)}</span>
              </>
            ) : (
              <span className="label">Original message was deleted</span>
            )}
          </button>
        )}

        {message.type === 'image' && message.mediaUrl && (
          <button type="button" className="msg-image" onClick={() => onOpenImage(message.mediaUrl!)}>
            <img src={message.mediaUrl} alt={caption || 'Shared image'} loading="lazy" />
          </button>
        )}
        {caption && <p className="msg-card">{caption}</p>}

        <span className={`msg-meta${message.localStatus === 'failed' ? ' failed' : ''}`}>
          <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
          {message.editedAt && <span>Edited</span>}
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
          {mine && settled && <span>{deliveryText(message, chat)}</span>}
          {settled && (
            <button
              type="button"
              className="msg-more"
              aria-label="Message actions"
              aria-expanded={menu !== 'closed'}
              onClick={() => setMenu(menu === 'closed' ? 'open' : 'closed')}
            >
              ⋯
            </button>
          )}
        </span>

        {menu === 'open' && (
          <span className="msg-actions">
            <button
              type="button"
              onClick={() => {
                setMenu('closed');
                onReply(message);
              }}
            >
              Reply
            </button>
            {mine && message.type === 'text' && (
              <button
                type="button"
                onClick={() => {
                  setMenu('closed');
                  onEdit(message);
                }}
              >
                Edit
              </button>
            )}
            {mine && (
              <button type="button" className="danger" onClick={() => setMenu('confirm-delete')}>
                Delete
              </button>
            )}
          </span>
        )}
        {menu === 'confirm-delete' && (
          <span className="msg-actions" role="alertdialog" aria-label="Delete message">
            <span>Delete for everyone?</span>
            <button type="button" className="danger" onClick={() => void remove()}>
              Delete
            </button>
            <button type="button" onClick={() => setMenu('closed')}>
              Keep
            </button>
          </span>
        )}
        {error && (
          <span className="msg-meta failed" role="alert">
            {error}
          </span>
        )}
      </div>
    </div>
  );
};
