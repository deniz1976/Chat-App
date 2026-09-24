import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ACCEPTED_TYPES, attachmentKind, validateAttachment } from '../lib/attachments';
import { formatBytes } from '../lib/format';
import { useChat } from '../state/ChatProvider';
import type { ThreadMessage } from '../state/store';
import { summaryOf } from './MessageItem';

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

export type ComposerMode =
  { kind: 'new' } | { kind: 'reply'; message: ThreadMessage } | { kind: 'edit'; message: ThreadMessage };

interface ComposerProps {
  chatId: string;
  mode: ComposerMode;
  onModeDone(): void;
}

interface Attachment {
  file: File;
  preview: string | null;
}

export const Composer = ({ chatId, mode, onModeDone }: ComposerProps) => {
  const { state, actions } = useChat();
  const editing = mode.kind === 'edit' ? mode.message : null;
  const replyTo = mode.kind === 'reply' ? mode.message : undefined;
  const [text, setText] = useState(editing?.content ?? '');
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      if (attachment?.preview) {
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

  const canSend = editing
    ? text.trim().length > 0 && text.trim() !== editing.content
    : text.trim().length > 0 || attachment !== null;

  const send = (event?: FormEvent) => {
    event?.preventDefault();
    if (!canSend) {
      return;
    }
    if (editing) {
      actions
        .editMessage(editing, text.trim())
        .then(onModeDone)
        .catch(() => setError('Could not save the edit. Try again.'));
      return;
    }
    if (attachment) {
      actions.sendAttachment(chatId, attachment.file, text.trim(), replyTo);
      setAttachment(null);
    } else {
      actions.sendText(chatId, text.trim(), replyTo);
    }
    setText('');
    setEmojiOpen(false);
    onModeDone();
    textarea.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      send(event);
    } else if (event.key === 'Escape' && mode.kind !== 'new') {
      event.preventDefault();
      onModeDone();
    }
  };

  const modeTarget = mode.kind === 'new' ? null : mode.message;
  const modeSender = modeTarget ? (state.users[modeTarget.senderId]?.displayName ?? 'Unknown') : '';

  const pickFile = (file: File | undefined) => {
    setError(null);
    if (!file) {
      return;
    }
    const problem = validateAttachment(file);
    if (problem) {
      setError(problem);
      return;
    }
    setAttachment({ file, preview: attachmentKind(file.type) === 'image' ? URL.createObjectURL(file) : null });
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
      {modeTarget && (
        <div className="composer-mode">
          <span className="composer-mode-text">
            <span className="label">{mode.kind === 'edit' ? 'Editing your message' : `Replying to ${modeSender}`}</span>
            <span>{summaryOf(modeTarget)}</span>
          </span>
          <button type="button" className="tool" onClick={onModeDone} aria-label="Cancel">
            ✕
          </button>
        </div>
      )}
      {attachment && (
        <div className="attachment">
          {attachment.preview ? (
            <img src={attachment.preview} alt="" />
          ) : (
            <span className="attachment-kind">{attachmentKind(attachment.file.type)}</span>
          )}
          <span className="attachment-name">
            <span>{attachment.file.name}</span>
            <span className="label">{formatBytes(attachment.file.size)} · add a caption below</span>
          </span>
          <button type="button" className="tool" onClick={() => setAttachment(null)} aria-label="Remove attachment">
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
        <button
          type="button"
          className="tool"
          onClick={() => fileInput.current?.click()}
          aria-label="Attach a file"
          disabled={!!editing}
        >
          +
        </button>
        <input
          ref={fileInput}
          id="composer-file"
          type="file"
          accept={ACCEPTED_TYPES}
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
          placeholder={editing ? 'Edit your message' : attachment ? 'Add a caption' : 'Type a message'}
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
          {editing ? 'Save' : 'Send'}
        </button>
      </div>
    </form>
  );
};
