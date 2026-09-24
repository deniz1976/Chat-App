import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { formatBytes } from '../lib/format';
import { useChat } from '../state/ChatProvider';

const EMOJIS = [
  '😀',
  '😂',
  '🙂',
  '😉',
  '😍',
  '🤔',
  '😅',
  '😢',
  '😮',
  '😴',
  '😎',
  '🙃',
  '👍',
  '👎',
  '👏',
  '🙏',
  '💪',
  '👋',
  '🎉',
  '🔥',
  '❤️',
  '💯',
  '✅',
  '❌',
  '☕',
  '🍕',
  '🚀',
  '📌',
  '📎',
  '⏰',
  '📞',
  '🎧',
];
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

interface Attachment {
  file: File;
  preview: string;
}

export const Composer = ({ chatId }: { chatId: string }) => {
  const { actions } = useChat();
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      if (attachment) {
        URL.revokeObjectURL(attachment.preview);
      }
    },
    [attachment],
  );

  useEffect(() => {
    const element = textarea.current;
    if (element) {
      element.style.height = 'auto';
      element.style.height = `${element.scrollHeight + 4}px`;
    }
  }, [text]);

  const canSend = text.trim().length > 0 || attachment !== null;

  const send = (event?: FormEvent) => {
    event?.preventDefault();
    if (!canSend) {
      return;
    }
    if (attachment) {
      actions.sendImage(chatId, attachment.file, text.trim());
      setAttachment(null);
    } else {
      actions.sendText(chatId, text.trim());
    }
    setText('');
    setEmojiOpen(false);
    textarea.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      send(event);
    }
  };

  const pickFile = (file: File | undefined) => {
    setError(null);
    if (!file) {
      return;
    }
    if (!IMAGE_TYPES.includes(file.type)) {
      setError('Only JPEG, PNG, GIF and WebP images can be sent.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError('Images must be 15 MB or smaller.');
      return;
    }
    setAttachment({ file, preview: URL.createObjectURL(file) });
  };

  const insertEmoji = (emoji: string) => {
    const element = textarea.current;
    const start = element?.selectionStart ?? text.length;
    const end = element?.selectionEnd ?? text.length;
    setText(text.slice(0, start) + emoji + text.slice(end));
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  return (
    <form className="composer" onSubmit={send} onPaste={(event) => pickFile(event.clipboardData.files[0])}>
      {emojiOpen && (
        <div className="emoji-panel" role="group" aria-label="Emoji">
          {EMOJIS.map((emoji) => (
            <button key={emoji} type="button" onClick={() => insertEmoji(emoji)} aria-label={`Insert ${emoji}`}>
              {emoji}
            </button>
          ))}
        </div>
      )}
      {attachment && (
        <div className="attachment">
          <img src={attachment.preview} alt="" />
          <span className="attachment-name">
            <span>{attachment.file.name}</span>
            <span className="label">{formatBytes(attachment.file.size)} · add a caption below</span>
          </span>
          <button type="button" className="tool" onClick={() => setAttachment(null)} aria-label="Remove image">
            ✕
          </button>
        </div>
      )}
      {error && (
        <p className="notice" role="alert" style={{ margin: 0 }}>
          {error}
        </p>
      )}
      <div className="composer-row">
        <button type="button" className="tool" onClick={() => fileInput.current?.click()} aria-label="Attach an image">
          +
        </button>
        <input
          ref={fileInput}
          id="composer-file"
          type="file"
          accept={IMAGE_TYPES.join(',')}
          hidden
          onChange={(event) => {
            pickFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
        <button
          type="button"
          className="tool"
          aria-label="Emoji"
          aria-expanded={emojiOpen}
          onClick={() => setEmojiOpen((open) => !open)}
        >
          ☺
        </button>
        <label className="sr-only" htmlFor="composer-text">
          Message
        </label>
        <textarea
          ref={textarea}
          id="composer-text"
          rows={1}
          autoFocus
          placeholder={attachment ? 'Add a caption' : 'Type a message'}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            if (event.target.value) {
              actions.notifyTyping(chatId);
            }
          }}
          onKeyDown={onKeyDown}
          onBlur={() => actions.stopTyping(chatId)}
          maxLength={4000}
        />
        <button type="submit" className="key send" disabled={!canSend}>
          Send
        </button>
      </div>
    </form>
  );
};
