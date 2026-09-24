import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import { api, ApiError } from '../api/client';
import type { Chat, Message, Profile, UserStatus } from '../api/types';
import { RealtimeClient, type RealtimeEvent } from '../realtime/RealtimeClient';
import { initialState, reducer, TYPING_TTL_MS, type State, type ThreadMessage } from './store';

const PAGE_SIZE = 50;
const TYPING_SIGNAL_INTERVAL_MS = 3000;
const TYPING_IDLE_MS = 4000;

export interface ChatActions {
  selectChat(chatId: string | null): void;
  loadOlder(chatId: string): Promise<void>;
  sendText(chatId: string, content: string): void;
  sendImage(chatId: string, file: File, caption: string): void;
  retry(message: ThreadMessage): void;
  discard(message: ThreadMessage): void;
  notifyTyping(chatId: string): void;
  stopTyping(chatId: string): void;
  startDirectChat(userId: string): Promise<string>;
  createGroup(name: string, userIds: string[]): Promise<string>;
  updateDisplayName(displayName: string): Promise<void>;
  uploadAvatar(file: File): Promise<void>;
  setStatus(status: UserStatus): Promise<void>;
  logout(): Promise<void>;
}

interface ChatContextValue {
  state: State;
  actions: ChatActions;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export const useChat = (): ChatContextValue => {
  const value = useContext(ChatContext);
  if (!value) {
    throw new Error('useChat must be used inside ChatProvider');
  }
  return value;
};

const isVisible = (): boolean => document.visibilityState === 'visible';

const createTempId = (): string => `local-${crypto.randomUUID()}`;

interface ChatProviderProps {
  me: Profile;
  onSignedOut(): void;
  children: ReactNode;
}

export const ChatProvider = ({ me, onSignedOut, children }: ChatProviderProps) => {
  const [state, dispatch] = useReducer(reducer, me, initialState);
  const stateRef = useRef(state);
  useLayoutEffect(() => {
    stateRef.current = state;
  }, [state]);

  const realtime = useMemo(() => new RealtimeClient(), []);
  const typingSignals = useRef(new Map<string, { lastSent: number; idleTimer?: number }>());
  const readRequests = useRef(new Set<string>());

  const refreshChat = useCallback(async (chatId: string) => {
    try {
      dispatch({ type: 'chatUpserted', chat: await api.chat(chatId) });
    } catch (error) {
      if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
        dispatch({ type: 'chatRemoved', chatId });
      }
    }
  }, []);

  const loadLatest = useCallback(async (chatId: string) => {
    dispatch({ type: 'threadLoading', chatId });
    try {
      const messages = await api.messages(chatId, undefined, PAGE_SIZE);
      dispatch({ type: 'threadLoaded', chatId, messages, older: false, hasMore: messages.length === PAGE_SIZE });
    } catch {
      dispatch({ type: 'threadFailed', chatId });
    }
  }, []);

  const loadChats = useCallback(async () => {
    const chats = await api.chats();
    dispatch({ type: 'chatsLoaded', chats });
  }, []);

  const handleEvent = useCallback(
    (event: RealtimeEvent) => {
      const current = stateRef.current;
      switch (event.type) {
        case 'NEW_MESSAGE': {
          const message = event.payload;
          if (!current.chats[message.chatId]) {
            void refreshChat(message.chatId);
            return;
          }
          const watching = current.activeChatId === message.chatId && isVisible();
          dispatch({
            type: 'messageReceived',
            message,
            countAsUnread: message.senderId !== current.me.id && !watching,
          });
          return;
        }
        case 'MESSAGE_UPDATED':
          dispatch({
            type: 'messageUpdated',
            message: event.payload.message,
            isLastMessage: event.payload.isLastMessage,
          });
          return;
        case 'MESSAGE_DELETED':
          dispatch({ type: 'messageDeleted', ...event.payload });
          return;
        case 'READ_RECEIPT':
          dispatch({ type: 'readReceipt', ...event.payload });
          return;
        case 'TYPING':
          if (event.payload.userId !== current.me.id) {
            dispatch({ type: 'typing', ...event.payload, expiresAt: Date.now() + TYPING_TTL_MS });
          }
          return;
        case 'USER_STATUS':
          dispatch({ type: 'presence', ...event.payload });
          return;
        case 'CHAT_CREATED':
        case 'CHAT_UPDATED':
          void refreshChat(event.payload.chatId);
          return;
        case 'CHAT_REMOVED':
          dispatch({ type: 'chatRemoved', chatId: event.payload.chatId });
          return;
        case 'ERROR':
          return;
      }
    },
    [refreshChat],
  );

  useEffect(() => {
    let wasConnected = false;
    const offEvent = realtime.onEvent(handleEvent);
    const offState = realtime.onStateChange((connection) => {
      dispatch({ type: 'connection', state: connection });
      if (connection === 'open') {
        if (wasConnected) {
          void loadChats();
          const activeChatId = stateRef.current.activeChatId;
          if (activeChatId) {
            void loadLatest(activeChatId);
          }
        }
        wasConnected = true;
      }
    });
    void loadChats();
    realtime.start();
    return () => {
      offEvent();
      offState();
      realtime.stop();
    };
  }, [realtime, handleEvent, loadChats, loadLatest]);

  useEffect(() => {
    const timer = window.setInterval(() => dispatch({ type: 'typingExpired', now: Date.now() }), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const activeChat = state.activeChatId ? state.chats[state.activeChatId] : undefined;
  const activeUnread = activeChat?.unreadCount ?? 0;

  useEffect(() => {
    const markRead = () => {
      const chatId = stateRef.current.activeChatId;
      const chat = chatId ? stateRef.current.chats[chatId] : undefined;
      if (!chat || chat.unreadCount === 0 || !isVisible() || readRequests.current.has(chat.id)) {
        return;
      }
      readRequests.current.add(chat.id);
      dispatch({ type: 'chatReadLocally', chatId: chat.id });
      api
        .markChatAsRead(chat.id)
        .catch(() => undefined)
        .finally(() => readRequests.current.delete(chat.id));
    };
    markRead();
    document.addEventListener('visibilitychange', markRead);
    return () => document.removeEventListener('visibilitychange', markRead);
  }, [state.activeChatId, activeUnread]);

  const totalUnread = Object.values(state.chats).reduce((sum, chat) => sum + chat.unreadCount, 0);
  useEffect(() => {
    document.title = totalUnread > 0 ? `(${totalUnread}) Switchboard` : 'Switchboard';
  }, [totalUnread]);

  const pendingFiles = useRef(new Map<string, File>());

  const deliver = useCallback((message: ThreadMessage, mediaFile?: File) => {
    const run = async () => {
      let mediaUrl = message.mediaUrl ?? undefined;
      if (mediaFile) {
        mediaUrl = (await api.uploadImage(mediaFile)).url;
      }
      const sent: Message = await api.sendMessage({
        chatId: message.chatId,
        content: message.content,
        type: message.type,
        mediaUrl,
      });
      pendingFiles.current.delete(message.id);
      dispatch({ type: 'messageSent', tempId: message.id, message: sent });
    };
    run().catch(() => dispatch({ type: 'messageFailed', tempId: message.id, chatId: message.chatId }));
  }, []);

  const stopTyping = useCallback(
    (chatId: string) => {
      const signal = typingSignals.current.get(chatId);
      if (!signal) {
        return;
      }
      window.clearTimeout(signal.idleTimer);
      typingSignals.current.delete(chatId);
      realtime.send('TYPING', { chatId, isTyping: false });
    },
    [realtime],
  );

  const actions = useMemo<ChatActions>(() => {
    const draft = (chatId: string, content: string, type: Message['type'], mediaUrl: string | null): ThreadMessage => {
      const now = new Date().toISOString();
      const me = stateRef.current.me;
      return {
        id: createTempId(),
        chatId,
        senderId: me.id,
        content,
        type,
        mediaUrl,
        replyToId: null,
        readBy: [me.id],
        createdAt: now,
        updatedAt: now,
        sender: { id: me.id, username: me.username, displayName: me.displayName, profileImage: me.profileImage },
        localStatus: 'sending',
      };
    };

    return {
      selectChat(chatId) {
        dispatch({ type: 'chatSelected', chatId });
        if (chatId && !stateRef.current.threads[chatId]?.loaded) {
          void loadLatest(chatId);
        }
      },

      async loadOlder(chatId) {
        const thread = stateRef.current.threads[chatId];
        const oldest = thread?.items.find((item) => !item.localStatus);
        if (!thread || thread.loading || !thread.hasMore || !oldest) {
          return;
        }
        dispatch({ type: 'threadLoading', chatId });
        try {
          const messages = await api.messages(chatId, oldest.id, PAGE_SIZE);
          dispatch({ type: 'threadLoaded', chatId, messages, older: true, hasMore: messages.length === PAGE_SIZE });
        } catch {
          dispatch({ type: 'threadFailed', chatId });
        }
      },

      sendText(chatId, content) {
        stopTyping(chatId);
        const message = draft(chatId, content, 'text', null);
        dispatch({ type: 'messageSending', message });
        deliver(message);
      },

      sendImage(chatId, file, caption) {
        stopTyping(chatId);
        const message = draft(chatId, caption || file.name, 'image', URL.createObjectURL(file));
        pendingFiles.current.set(message.id, file);
        dispatch({ type: 'messageSending', message });
        deliver({ ...message, mediaUrl: null }, file);
      },

      retry(message) {
        const file = pendingFiles.current.get(message.id);
        dispatch({ type: 'messageDiscarded', tempId: message.id, chatId: message.chatId });
        const next = { ...message, id: createTempId(), localStatus: 'sending' as const };
        if (file) {
          pendingFiles.current.delete(message.id);
          pendingFiles.current.set(next.id, file);
        }
        dispatch({ type: 'messageSending', message: next });
        deliver(file ? { ...next, mediaUrl: null } : next, file);
      },

      discard(message) {
        pendingFiles.current.delete(message.id);
        dispatch({ type: 'messageDiscarded', tempId: message.id, chatId: message.chatId });
      },

      notifyTyping(chatId) {
        const now = Date.now();
        const signal = typingSignals.current.get(chatId) ?? { lastSent: 0 };
        if (now - signal.lastSent > TYPING_SIGNAL_INTERVAL_MS) {
          realtime.send('TYPING', { chatId, isTyping: true });
          signal.lastSent = now;
        }
        window.clearTimeout(signal.idleTimer);
        signal.idleTimer = window.setTimeout(() => stopTyping(chatId), TYPING_IDLE_MS);
        typingSignals.current.set(chatId, signal);
      },

      stopTyping,

      async startDirectChat(userId) {
        const chat: Chat = await api.createDirectChat(userId);
        dispatch({ type: 'chatUpserted', chat });
        return chat.id;
      },

      async createGroup(name, userIds) {
        const chat = await api.createGroupChat(name, userIds);
        dispatch({ type: 'chatUpserted', chat });
        return chat.id;
      },

      async updateDisplayName(displayName) {
        const me = stateRef.current.me;
        const user = await api.updateProfile(me.id, { displayName });
        dispatch({ type: 'profileUpdated', profile: { ...me, ...user } });
      },

      async uploadAvatar(file) {
        const { user } = await api.uploadAvatar(file);
        dispatch({ type: 'profileUpdated', profile: user });
      },

      async setStatus(status) {
        const me = stateRef.current.me;
        await api.setStatus(me.id, status);
        dispatch({ type: 'profileUpdated', profile: { ...me, status } });
      },

      async logout() {
        realtime.stop();
        await api.logout().catch(() => undefined);
        onSignedOut();
      },
    };
  }, [deliver, loadLatest, onSignedOut, realtime, stopTyping]);

  const value = useMemo(() => ({ state, actions }), [state, actions]);
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
