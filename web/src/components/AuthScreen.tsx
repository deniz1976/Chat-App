import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../api/client';
import type { Profile } from '../api/types';

type Mode = 'login' | 'register';

const LIT_JACKS = new Set([2, 9, 12, 21, 26, 30]);

export const AuthScreen = ({ onSignedIn }: { onSignedIn(profile: Profile): void }) => {
  const [mode, setMode] = useState<Mode>('login');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? '').trim();
    setBusy(true);
    setError(null);
    try {
      const { user } =
        mode === 'login'
          ? await api.login(value('email'), String(form.get('password') ?? ''))
          : await api.register({
              username: value('username'),
              displayName: value('displayName'),
              email: value('email'),
              password: String(form.get('password') ?? ''),
            });
      onSignedIn(user);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Could not reach the server. Check your connection and try again.',
      );
      setBusy(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  return (
    <main className="auth">
      <section className="auth-hero" aria-labelledby="wordmark">
        <h1 className="auth-wordmark" id="wordmark">
          Switch
          <br />
          board
        </h1>
        <p className="auth-tagline">Every conversation is a line on the board. Plug in, see who is lit, and talk.</p>
        <div className="auth-field-grid" aria-hidden="true">
          {Array.from({ length: 32 }, (_, index) => (
            <span key={index} className={LIT_JACKS.has(index) ? 'lit' : undefined} />
          ))}
        </div>
      </section>

      <section className="auth-card" aria-label={mode === 'login' ? 'Sign in' : 'Create account'}>
        <div className="auth-modes">
          <button type="button" aria-pressed={mode === 'login'} onClick={() => switchMode('login')}>
            Sign in
          </button>
          <button type="button" aria-pressed={mode === 'register'} onClick={() => switchMode('register')}>
            Create account
          </button>
        </div>

        <form className="auth-form" onSubmit={submit} key={mode}>
          {mode === 'register' && (
            <>
              <label className="field">
                <span className="label">Username</span>
                <input
                  className="input"
                  id="auth-username"
                  name="username"
                  autoComplete="username"
                  required
                  minLength={3}
                  maxLength={30}
                  pattern="[A-Za-z0-9]+"
                  title="Letters and numbers only"
                />
              </label>
              <label className="field">
                <span className="label">Display name</span>
                <input
                  className="input"
                  id="auth-display-name"
                  name="displayName"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={50}
                />
              </label>
            </>
          )}
          <label className="field">
            <span className="label">Email</span>
            <input className="input" id="auth-email" name="email" type="email" autoComplete="email" required />
          </label>
          <label className="field">
            <span className="label">Password</span>
            <input
              className="input"
              id="auth-password"
              name="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={6}
            />
          </label>
          {error && (
            <p className="notice" role="alert">
              {error}
            </p>
          )}
          <button className="key" type="submit" disabled={busy}>
            {busy ? 'Connecting…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </section>
    </main>
  );
};
