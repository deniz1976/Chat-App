import { useRef, useState } from 'react';
import { cordFor } from '../lib/cords';
import type { ThemePreference } from '../lib/theme';
import { useChat } from '../state/ChatProvider';
import { Board } from './Board';
import { Cord } from './Cord';
import { Lightbox } from './Lightbox';
import { Line } from './Line';
import { LineDetailsDialog } from './LineDetailsDialog';
import { NewLineDialog } from './NewLineDialog';
import { ProfileDialog } from './ProfileDialog';

type Overlay =
  | { kind: 'new-line' }
  | { kind: 'profile' }
  | { kind: 'image'; url: string }
  | { kind: 'details'; chatId: string }
  | null;

interface SwitchboardProps {
  theme: ThemePreference;
  onThemeChange(theme: ThemePreference): void;
}

export const Switchboard = ({ theme, onThemeChange }: SwitchboardProps) => {
  const { state, actions } = useChat();
  const [overlay, setOverlay] = useState<Overlay>(null);
  const root = useRef<HTMLDivElement>(null);
  const jackSocket = useRef<HTMLSpanElement>(null);
  const lineSocket = useRef<HTMLSpanElement>(null);
  const activeChatId = state.activeChatId;
  const close = () => setOverlay(null);

  return (
    <div ref={root} className={`switchboard${activeChatId ? ' has-line' : ''}`}>
      <Board
        ref={jackSocket}
        theme={theme}
        onThemeChange={onThemeChange}
        onNewLine={() => setOverlay({ kind: 'new-line' })}
        onOpenProfile={() => setOverlay({ kind: 'profile' })}
      />
      <Line
        ref={lineSocket}
        onBack={() => actions.selectChat(null)}
        onOpenDetails={(chatId) => setOverlay({ kind: 'details', chatId })}
        onOpenImage={(url) => setOverlay({ kind: 'image', url })}
        onNewLine={() => setOverlay({ kind: 'new-line' })}
      />
      {activeChatId && (
        <Cord
          container={root}
          from={jackSocket}
          to={lineSocket}
          color={cordFor(activeChatId)}
          deps={[activeChatId, Object.keys(state.chats).length, state.chats[activeChatId]?.lastMessage?.id]}
        />
      )}

      {overlay?.kind === 'new-line' && (
        <NewLineDialog
          onClose={close}
          onOpened={(chatId) => {
            close();
            actions.selectChat(chatId);
          }}
        />
      )}
      {overlay?.kind === 'profile' && <ProfileDialog onClose={close} />}
      {overlay?.kind === 'image' && <Lightbox url={overlay.url} onClose={close} />}
      {overlay?.kind === 'details' && state.chats[overlay.chatId] && (
        <LineDetailsDialog chat={state.chats[overlay.chatId]!} onClose={close} />
      )}
    </div>
  );
};
