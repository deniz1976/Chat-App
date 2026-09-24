import { useCallback, useEffect, useState } from 'react';
import { api } from './api/client';
import type { Profile } from './api/types';
import { AuthScreen } from './components/AuthScreen';
import { Switchboard } from './components/Switchboard';
import { useThemePreference } from './lib/theme';
import { ChatProvider } from './state/ChatProvider';

type Session = { status: 'checking' } | { status: 'signed-out' } | { status: 'signed-in'; me: Profile };

export const App = () => {
  const [session, setSession] = useState<Session>({ status: 'checking' });
  const [theme, setTheme] = useThemePreference();

  useEffect(() => {
    api
      .profile()
      .then((me) => setSession({ status: 'signed-in', me }))
      .catch(() => setSession({ status: 'signed-out' }));
  }, []);

  const signOut = useCallback(() => setSession({ status: 'signed-out' }), []);

  if (session.status === 'checking') {
    return null;
  }

  if (session.status === 'signed-out') {
    return <AuthScreen onSignedIn={(me) => setSession({ status: 'signed-in', me })} />;
  }

  return (
    <ChatProvider key={session.me.id} me={session.me} onSignedOut={signOut}>
      <Switchboard theme={theme} onThemeChange={setTheme} />
    </ChatProvider>
  );
};
