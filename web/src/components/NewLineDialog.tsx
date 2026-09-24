import { useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import type { User } from '../api/types';
import { presenceText } from '../lib/format';
import { useUserSearch } from '../lib/useUserSearch';
import { useChat } from '../state/ChatProvider';
import { Avatar } from './Avatar';
import { Dialog, DialogHeader } from './Dialog';

type Mode = 'direct' | 'group';

export const NewLineDialog = ({ onClose, onOpened }: { onClose(): void; onOpened(chatId: string): void }) => {
  const { state, actions } = useChat();
  const [mode, setMode] = useState<Mode>('direct');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<User[]>([]);
  const [groupName, setGroupName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { term, results, searching } = useUserSearch(query, [state.me.id]);

  const run = async (task: () => Promise<string>) => {
    setBusy(true);
    setError(null);
    try {
      onOpened(await task());
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not open the line. Try again.');
      setBusy(false);
    }
  };

  const toggle = (user: User) =>
    setSelected((current) =>
      current.some((item) => item.id === user.id) ? current.filter((item) => item.id !== user.id) : [...current, user],
    );

  const createGroup = (event: FormEvent) => {
    event.preventDefault();
    void run(() =>
      actions.createGroup(
        groupName.trim(),
        selected.map((user) => user.id),
      ),
    );
  };

  return (
    <Dialog title="New line" onClose={onClose}>
      <DialogHeader title="New line" onClose={onClose} />
      <div className="tabs" role="tablist">
        {(['direct', 'group'] as const).map((value) => (
          <button key={value} type="button" role="tab" aria-selected={mode === value} onClick={() => setMode(value)}>
            {value === 'direct' ? 'Person' : 'Group'}
          </button>
        ))}
      </div>

      {mode === 'group' && (
        <label className="field">
          <span className="label">Group name</span>
          <input
            className="input"
            id="group-name"
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
            minLength={3}
            maxLength={50}
            placeholder="Weekend trip"
          />
        </label>
      )}

      <label className="field">
        <span className="label">{mode === 'direct' ? 'Find a person' : 'Add people'}</span>
        <input
          className="input"
          id="people-search"
          type="search"
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name or username"
        />
      </label>

      {mode === 'group' && selected.length > 0 && (
        <div className="chips">
          {selected.map((user) => (
            <button
              key={user.id}
              type="button"
              className="chip"
              onClick={() => toggle(user)}
              aria-label={`Remove ${user.displayName}`}
            >
              {user.displayName} ✕
            </button>
          ))}
        </div>
      )}

      {term && (
        <ul className="people" aria-busy={searching}>
          {results.map((user) => (
            <li key={user.id}>
              <button
                type="button"
                className="person"
                disabled={busy}
                aria-pressed={mode === 'group' ? selected.some((item) => item.id === user.id) : undefined}
                onClick={() => (mode === 'direct' ? void run(() => actions.startDirectChat(user.id)) : toggle(user))}
              >
                <Avatar name={user.displayName} src={user.profileImage} status={user.status} />
                <span className="person-name">
                  <b>{user.displayName}</b>
                  <span className="label">
                    @{user.username} · {presenceText(user)}
                  </span>
                </span>
              </button>
            </li>
          ))}
          {!searching && results.length === 0 && <li className="label">Nobody matches “{term}”.</li>}
        </ul>
      )}

      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}

      {mode === 'group' && (
        <form className="dialog-actions" onSubmit={createGroup}>
          <button type="button" className="key key-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="key" disabled={busy || groupName.trim().length < 3 || selected.length === 0}>
            Open group line
          </button>
        </form>
      )}
    </Dialog>
  );
};
