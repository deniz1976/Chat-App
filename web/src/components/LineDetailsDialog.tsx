import { useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import type { Chat, User } from '../api/types';
import { chatTitle, otherMember, presenceText } from '../lib/format';
import { useUserSearch } from '../lib/useUserSearch';
import { useChat } from '../state/ChatProvider';
import { Avatar } from './Avatar';
import { Dialog, DialogHeader } from './Dialog';

type Confirm = { kind: 'leave' } | { kind: 'delete' } | { kind: 'remove'; user: User } | null;

interface LineDetailsDialogProps {
  chat: Chat;
  onClose(): void;
}

export const LineDetailsDialog = ({ chat, onClose }: LineDetailsDialogProps) => {
  const { state, actions } = useChat();
  const meId = state.me.id;
  const isGroup = chat.type === 'group';
  const isCreator = chat.createdBy === meId;
  const isAdmin = isCreator || chat.admins.includes(meId);
  const title = chatTitle(chat, meId, state.users);
  const other = isGroup ? undefined : otherMember(chat, meId, state.users);

  const [name, setName] = useState(chat.name ?? '');
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const search = useUserSearch(adding ? query : '', chat.participants);

  const members = chat.members
    .map((member) => state.users[member.id] ?? member)
    .sort((a, b) => {
      const rank = (user: User) => (user.id === chat.createdBy ? 0 : chat.admins.includes(user.id) ? 1 : 2);
      return rank(a) - rank(b) || a.displayName.localeCompare(b.displayName);
    });

  const attempt = async (task: () => Promise<void>, success?: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await task();
      if (success) {
        setMessage({ text: success, error: false });
      }
    } catch (caught) {
      setMessage({
        text: caught instanceof ApiError ? caught.message : 'Something went wrong. Try again.',
        error: true,
      });
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const rename = (event: FormEvent) => {
    event.preventDefault();
    void attempt(() => actions.renameGroup(chat.id, name.trim()), 'Group renamed.');
  };

  const confirmText =
    confirm?.kind === 'leave'
      ? `Leave ${title}? You will stop receiving its messages.`
      : confirm?.kind === 'delete'
        ? `Delete ${title} for everyone? Its messages will no longer be available.`
        : confirm?.kind === 'remove'
          ? `Remove ${confirm.user.displayName} from ${title}?`
          : '';

  const runConfirmed = () => {
    if (confirm?.kind === 'leave') {
      void attempt(async () => {
        await actions.leaveChat(chat.id);
        onClose();
      });
    } else if (confirm?.kind === 'delete') {
      void attempt(async () => {
        await actions.deleteChat(chat.id);
        onClose();
      });
    } else if (confirm?.kind === 'remove') {
      const user = confirm.user;
      void attempt(() => actions.removeMember(chat.id, user.id), `${user.displayName} was removed.`);
    }
  };

  return (
    <Dialog title="Line details" onClose={onClose}>
      <DialogHeader title="Line details" onClose={onClose} />

      <div className="profile-avatar">
        <Avatar
          name={title}
          src={isGroup ? chat.avatar : other?.profileImage}
          square={isGroup}
          size={72}
          status={other?.status}
        />
        <div className="details-title">
          <b>{title}</b>
          <span className="label">
            {isGroup ? `Group · ${chat.participants.length} members` : `@${other?.username} · ${presenceText(other)}`}
          </span>
          {isGroup && isAdmin && (
            <>
              <button
                type="button"
                className="key key-ghost"
                disabled={busy}
                onClick={() => photoInput.current?.click()}
              >
                Change group photo
              </button>
              <input
                ref={photoInput}
                id="group-photo"
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) {
                    void attempt(() => actions.changeGroupPhoto(chat.id, file), 'Group photo updated.');
                  }
                }}
              />
            </>
          )}
        </div>
      </div>

      {isGroup && isAdmin && (
        <form className="field" onSubmit={rename}>
          <label className="label" htmlFor="group-rename">
            Group name
          </label>
          <div className="inline-form">
            <input
              className="input"
              id="group-rename"
              value={name}
              onChange={(event) => setName(event.target.value)}
              minLength={3}
              maxLength={50}
              required
            />
            <button type="submit" className="key" disabled={busy || name.trim() === chat.name}>
              Rename
            </button>
          </div>
        </form>
      )}

      {isGroup && (
        <section className="field" aria-labelledby="members-heading">
          <div className="section-head">
            <span className="label" id="members-heading">
              Members
            </span>
            {isAdmin && (
              <button type="button" className="text-button" onClick={() => setAdding(!adding)} aria-expanded={adding}>
                {adding ? 'Done' : '+ Add people'}
              </button>
            )}
          </div>

          {adding && (
            <>
              <input
                className="input"
                id="add-member-search"
                type="search"
                autoFocus
                placeholder="Name or username"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {search.term && (
                <ul className="people" aria-busy={search.searching}>
                  {search.results.map((user) => (
                    <li key={user.id}>
                      <button
                        type="button"
                        className="person"
                        disabled={busy}
                        onClick={() =>
                          void attempt(async () => {
                            await actions.addMember(chat.id, user.id);
                            setQuery('');
                          }, `${user.displayName} was added.`)
                        }
                      >
                        <Avatar name={user.displayName} src={user.profileImage} status={user.status} />
                        <span className="person-name">
                          <b>{user.displayName}</b>
                          <span className="label">Add to group</span>
                        </span>
                      </button>
                    </li>
                  ))}
                  {!search.searching && search.results.length === 0 && (
                    <li className="label">Nobody else matches “{search.term}”.</li>
                  )}
                </ul>
              )}
            </>
          )}

          <ul className="people members">
            {members.map((member) => {
              const memberIsCreator = member.id === chat.createdBy;
              const memberIsAdmin = memberIsCreator || chat.admins.includes(member.id);
              const canManage = isAdmin && member.id !== meId && !memberIsCreator;
              return (
                <li key={member.id} className="member">
                  <Avatar name={member.displayName} src={member.profileImage} status={member.status} />
                  <span className="person-name">
                    <b>
                      {member.displayName}
                      {member.id === meId && ' (you)'}
                    </b>
                    <span className="label">{presenceText(member)}</span>
                  </span>
                  {memberIsCreator ? (
                    <span className="plate">Creator</span>
                  ) : (
                    memberIsAdmin && <span className="plate">Admin</span>
                  )}
                  {canManage && (
                    <span className="member-actions">
                      <button
                        type="button"
                        className="text-button"
                        disabled={busy}
                        onClick={() => void attempt(() => actions.setAdmin(chat.id, member.id, !memberIsAdmin))}
                      >
                        {memberIsAdmin ? 'Revoke admin' : 'Make admin'}
                      </button>
                      <button
                        type="button"
                        className="text-button danger"
                        disabled={busy}
                        onClick={() => setConfirm({ kind: 'remove', user: member })}
                      >
                        Remove
                      </button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {message && (
        <p className={message.error ? 'notice' : 'label'} role={message.error ? 'alert' : 'status'}>
          {message.text}
        </p>
      )}

      {confirm ? (
        <div className="confirm" role="alertdialog" aria-label="Confirm">
          <p>{confirmText}</p>
          <div className="dialog-actions">
            <button type="button" className="key key-ghost" onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button type="button" className="key key-danger" disabled={busy} onClick={runConfirmed}>
              {confirm.kind === 'leave' ? 'Leave' : confirm.kind === 'delete' ? 'Delete' : 'Remove'}
            </button>
          </div>
        </div>
      ) : (
        <div className="dialog-actions">
          {isGroup && !isCreator && (
            <button type="button" className="key key-ghost" onClick={() => setConfirm({ kind: 'leave' })}>
              Leave group
            </button>
          )}
          {isCreator && (
            <button type="button" className="key key-danger" onClick={() => setConfirm({ kind: 'delete' })}>
              Delete {isGroup ? 'group' : 'chat'}
            </button>
          )}
        </div>
      )}
    </Dialog>
  );
};
