import { useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import { useChat } from '../state/ChatProvider';
import { Avatar } from './Avatar';
import { Dialog, DialogHeader } from './Dialog';

export const ProfileDialog = ({ onClose }: { onClose(): void }) => {
  const { state, actions } = useChat();
  const me = state.me;
  const [displayName, setDisplayName] = useState(me.displayName);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const attempt = async (task: () => Promise<void>, success: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await task();
      setMessage({ text: success, error: false });
    } catch (caught) {
      setMessage({
        text: caught instanceof ApiError ? caught.message : 'Something went wrong. Try again.',
        error: true,
      });
    } finally {
      setBusy(false);
    }
  };

  const saveName = (event: FormEvent) => {
    event.preventDefault();
    void attempt(() => actions.updateDisplayName(displayName.trim()), 'Display name saved.');
  };

  return (
    <Dialog title="Your profile" onClose={onClose}>
      <DialogHeader title="Your profile" onClose={onClose} />

      <div className="profile-avatar">
        <Avatar name={me.displayName} src={me.profileImage} size={72} />
        <div style={{ display: 'grid', gap: 8 }}>
          <button type="button" className="key key-ghost" disabled={busy} onClick={() => fileInput.current?.click()}>
            Change photo
          </button>
          <span className="label">JPEG, PNG, GIF or WebP, up to 15 MB</span>
        </div>
        <input
          ref={fileInput}
          id="avatar-file"
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) {
              void attempt(() => actions.uploadAvatar(file), 'Photo updated.');
            }
          }}
        />
      </div>

      <form className="field" onSubmit={saveName}>
        <label className="label" htmlFor="profile-display-name">
          Display name
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="input"
            id="profile-display-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            minLength={2}
            maxLength={50}
            required
          />
          <button type="submit" className="key" disabled={busy || displayName.trim() === me.displayName}>
            Save
          </button>
        </div>
      </form>

      <dl className="label" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', margin: 0 }}>
        <dt>Username</dt>
        <dd style={{ margin: 0, color: 'var(--ink)' }}>@{me.username}</dd>
        <dt>Email</dt>
        <dd style={{ margin: 0, color: 'var(--ink)', textTransform: 'none' }}>{me.email}</dd>
      </dl>

      {message && (
        <p
          className={message.error ? 'notice' : 'label'}
          role={message.error ? 'alert' : 'status'}
          style={{ margin: 0 }}
        >
          {message.text}
        </p>
      )}

      <div className="dialog-actions">
        <button type="button" className="key key-danger" onClick={() => void actions.logout()}>
          Sign out
        </button>
      </div>
    </Dialog>
  );
};
