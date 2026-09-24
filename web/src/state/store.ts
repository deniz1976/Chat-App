import type { Chat, LastMessage, Message, Profile, User, UserStatus } from '../api/types';
import type { ConnectionState } from '../realtime/RealtimeClient';

export type LocalStatus = 'sending' | 'failed';

export interface ThreadMessage extends Message {
  localStatus?: LocalStatus;
}

export interface Thread {
  items: ThreadMessage[];
  hasMore: boolean;
  loaded: boolean;
  loading: boolean;
}

export interface State {
  me: Profile;
  chats: Record<string, Chat>;
  users: Record<string, User>;
  threads: Record<string, Thread>;
  typing: Record<string, Record<string, number>>;
  activeChatId: string | null;
  connection: ConnectionState;
}

export type Action =
  | { type: 'profileUpdated'; profile: Profile }
  | { type: 'chatsLoaded'; chats: Chat[] }
  | { type: 'chatUpserted'; chat: Chat }
  | { type: 'chatRemoved'; chatId: string }
  | { type: 'chatSelected'; chatId: string | null }
  | { type: 'chatReadLocally'; chatId: string }
  | { type: 'threadLoading'; chatId: string }
  | { type: 'threadLoaded'; chatId: string; messages: Message[]; older: boolean; hasMore: boolean }
  | { type: 'threadFailed'; chatId: string }
  | { type: 'messageSending'; message: ThreadMessage }
  | { type: 'messageSent'; tempId: string; message: Message }
  | { type: 'messageFailed'; tempId: string; chatId: string }
  | { type: 'messageDiscarded'; tempId: string; chatId: string }
  | { type: 'messageReceived'; message: Message; countAsUnread: boolean }
  | { type: 'messageUpdated'; message: Message; isLastMessage: boolean }
  | { type: 'messageDeleted'; chatId: string; messageId: string; lastMessage?: LastMessage | null }
  | { type: 'readReceipt'; chatId: string; readerId: string; messageIds: string[] }
  | { type: 'presence'; userId: string; status: UserStatus; timestamp: string }
  | { type: 'typing'; chatId: string; userId: string; isTyping: boolean; expiresAt: number }
  | { type: 'typingExpired'; now: number }
  | { type: 'connection'; state: ConnectionState };

export const TYPING_TTL_MS = 6000;

export const initialState = (me: Profile): State => ({
  me,
  chats: {},
  users: { [me.id]: me },
  threads: {},
  typing: {},
  activeChatId: null,
  connection: 'connecting',
});

const emptyThread: Thread = { items: [], hasMore: true, loaded: false, loading: false };

const toLastMessage = (message: Message): LastMessage => ({
  id: message.id,
  senderId: message.senderId,
  content: message.content,
  type: message.type,
  mediaUrl: message.mediaUrl,
  createdAt: message.createdAt,
});

const byCreatedAt = (a: Message, b: Message): number =>
  a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : a.createdAt.localeCompare(b.createdAt);

const upsertMessages = (items: ThreadMessage[], incoming: Message[]): ThreadMessage[] => {
  const byId = new Map(items.map((item) => [item.id, item]));
  incoming.forEach((message) => byId.set(message.id, { ...message }));
  const confirmed = [...byId.values()].filter((item) => !item.localStatus).sort(byCreatedAt);
  const local = [...byId.values()].filter((item) => item.localStatus);
  return [...confirmed, ...local];
};

const mergeUsers = (users: Record<string, User>, incoming: User[]): Record<string, User> => {
  const next = { ...users };
  incoming.forEach((user) => {
    next[user.id] = { ...next[user.id], ...user };
  });
  return next;
};

const updateThread = (state: State, chatId: string, update: (thread: Thread) => Thread): State => ({
  ...state,
  threads: { ...state.threads, [chatId]: update(state.threads[chatId] ?? emptyThread) },
});

const updateChat = (state: State, chatId: string, update: (chat: Chat) => Chat): State => {
  const chat = state.chats[chatId];
  return chat ? { ...state, chats: { ...state.chats, [chatId]: update(chat) } } : state;
};

const clearTyping = (state: State, chatId: string, userId: string): State => {
  const chatTyping = state.typing[chatId];
  if (!chatTyping?.[userId]) {
    return state;
  }
  const rest = { ...chatTyping };
  delete rest[userId];
  return { ...state, typing: { ...state.typing, [chatId]: rest } };
};

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'profileUpdated':
      return { ...state, me: action.profile, users: mergeUsers(state.users, [action.profile]) };

    case 'chatsLoaded':
      return {
        ...state,
        chats: Object.fromEntries(action.chats.map((chat) => [chat.id, chat])),
        users: mergeUsers(
          state.users,
          action.chats.flatMap((chat) => chat.members),
        ),
      };

    case 'chatUpserted':
      return {
        ...state,
        chats: { ...state.chats, [action.chat.id]: action.chat },
        users: mergeUsers(state.users, action.chat.members),
      };

    case 'chatRemoved': {
      const chats = { ...state.chats };
      delete chats[action.chatId];
      return { ...state, chats, activeChatId: state.activeChatId === action.chatId ? null : state.activeChatId };
    }

    case 'chatSelected':
      return { ...state, activeChatId: action.chatId };

    case 'chatReadLocally':
      return updateChat(state, action.chatId, (chat) => ({ ...chat, unreadCount: 0 }));

    case 'threadLoading':
      return updateThread(state, action.chatId, (thread) => ({ ...thread, loading: true }));

    case 'threadLoaded':
      return updateThread(state, action.chatId, (thread) => ({
        items: upsertMessages(thread.items, action.messages),
        hasMore: action.older || !thread.loaded ? action.hasMore : thread.hasMore,
        loaded: true,
        loading: false,
      }));

    case 'threadFailed':
      return updateThread(state, action.chatId, (thread) => ({ ...thread, loading: false }));

    case 'messageSending':
      return updateThread(state, action.message.chatId, (thread) => ({
        ...thread,
        items: [...thread.items, action.message],
      }));

    case 'messageSent': {
      const next = updateThread(state, action.message.chatId, (thread) => ({
        ...thread,
        items: upsertMessages(
          thread.items.filter((item) => item.id !== action.tempId),
          [action.message],
        ),
      }));
      return updateChat(next, action.message.chatId, (chat) => ({
        ...chat,
        lastMessage: toLastMessage(action.message),
      }));
    }

    case 'messageFailed':
      return updateThread(state, action.chatId, (thread) => ({
        ...thread,
        items: thread.items.map((item) => (item.id === action.tempId ? { ...item, localStatus: 'failed' } : item)),
      }));

    case 'messageDiscarded':
      return updateThread(state, action.chatId, (thread) => ({
        ...thread,
        items: thread.items.filter((item) => item.id !== action.tempId),
      }));

    case 'messageReceived': {
      const { message } = action;
      let next = clearTyping(state, message.chatId, message.senderId);
      if (next.threads[message.chatId]?.loaded) {
        next = updateThread(next, message.chatId, (thread) => ({
          ...thread,
          items: upsertMessages(thread.items, [message]),
        }));
      }
      return updateChat(next, message.chatId, (chat) => ({
        ...chat,
        lastMessage: toLastMessage(message),
        updatedAt: message.createdAt,
        unreadCount: chat.unreadCount + (action.countAsUnread ? 1 : 0),
      }));
    }

    case 'messageUpdated': {
      const { message } = action;
      const next = updateThread(state, message.chatId, (thread) => ({
        ...thread,
        items: thread.items.map((item) => (item.id === message.id ? { ...item, ...message } : item)),
      }));
      return action.isLastMessage
        ? updateChat(next, message.chatId, (chat) => ({ ...chat, lastMessage: toLastMessage(message) }))
        : next;
    }

    case 'messageDeleted': {
      const next = updateThread(state, action.chatId, (thread) => ({
        ...thread,
        items: thread.items.filter((item) => item.id !== action.messageId),
      }));
      return action.lastMessage === undefined
        ? next
        : updateChat(next, action.chatId, (chat) => ({ ...chat, lastMessage: action.lastMessage ?? null }));
    }

    case 'readReceipt': {
      const ids = new Set(action.messageIds);
      const next = updateThread(state, action.chatId, (thread) => ({
        ...thread,
        items: thread.items.map((item) =>
          ids.has(item.id) && !item.readBy.includes(action.readerId)
            ? { ...item, readBy: [...item.readBy, action.readerId] }
            : item,
        ),
      }));
      return action.readerId === state.me.id
        ? updateChat(next, action.chatId, (chat) => ({
            ...chat,
            unreadCount: Math.max(0, chat.unreadCount - action.messageIds.length),
          }))
        : next;
    }

    case 'presence': {
      const user = state.users[action.userId];
      if (!user) {
        return state;
      }
      return {
        ...state,
        users: { ...state.users, [action.userId]: { ...user, status: action.status, lastSeen: action.timestamp } },
      };
    }

    case 'typing':
      if (!action.isTyping) {
        return clearTyping(state, action.chatId, action.userId);
      }
      return {
        ...state,
        typing: {
          ...state.typing,
          [action.chatId]: { ...state.typing[action.chatId], [action.userId]: action.expiresAt },
        },
      };

    case 'typingExpired': {
      let changed = false;
      const typing = Object.fromEntries(
        Object.entries(state.typing).map(([chatId, users]) => {
          const active = Object.fromEntries(Object.entries(users).filter(([, expiresAt]) => expiresAt > action.now));
          changed ||= Object.keys(active).length !== Object.keys(users).length;
          return [chatId, active];
        }),
      );
      return changed ? { ...state, typing } : state;
    }

    case 'connection':
      return { ...state, connection: action.state };
  }
};

export const sortedChats = (state: State): Chat[] =>
  Object.values(state.chats).sort((a, b) =>
    (b.lastMessage?.createdAt ?? b.updatedAt).localeCompare(a.lastMessage?.createdAt ?? a.updatedAt),
  );
