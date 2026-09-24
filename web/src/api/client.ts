import type { Chat, Message, Profile, UploadedFile, User } from './types';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

const request = async <T>(method: Method, path: string, body?: unknown): Promise<T> => {
  const isForm = body instanceof FormData;
  const response = await fetch(`/api/v1${path}`, {
    method,
    headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(data?.message ?? `Request failed with status ${response.status}`, response.status);
  }
  return data as T;
};

const fileForm = (file: File): FormData => {
  const form = new FormData();
  form.append('file', file);
  return form;
};

export interface RegisterInput {
  username: string;
  displayName: string;
  email: string;
  password: string;
}

export interface SendMessageInput {
  chatId: string;
  content: string;
  type?: Message['type'];
  mediaUrl?: string;
  replyToId?: string;
}

export const api = {
  login: (email: string, password: string) => request<{ user: Profile }>('POST', '/auth/login', { email, password }),
  register: (input: RegisterInput) => request<{ user: Profile }>('POST', '/auth/register', input),
  logout: () => request<void>('POST', '/auth/logout'),

  profile: () => request<Profile>('GET', '/users/profile'),
  updateProfile: (id: string, data: { displayName?: string }) => request<User>('PUT', `/users/${id}`, data),
  uploadAvatar: (file: File) => request<{ user: Profile }>('PUT', '/users/profile/avatar', fileForm(file)),
  setStatus: (id: string, status: User['status']) =>
    request<{ status: User['status'] }>('PUT', `/users/${id}/status`, { status }),
  searchUsers: (query: string) => request<User[]>('GET', `/users/search?q=${encodeURIComponent(query)}&limit=20`),

  chats: () => request<Chat[]>('GET', '/chats'),
  chat: (id: string) => request<Chat>('GET', `/chats/${id}`),
  createDirectChat: (userId: string) => request<Chat>('POST', '/chats', { type: 'direct', participants: [userId] }),
  createGroupChat: (name: string, participants: string[]) =>
    request<Chat>('POST', '/chats', { type: 'group', name, participants }),
  markChatAsRead: (id: string) => request<{ messageIds: string[] }>('POST', `/chats/${id}/read`),
  updateChat: (id: string, data: { name?: string; avatar?: string | null }) =>
    request<Chat>('PUT', `/chats/${id}`, data),
  deleteChat: (id: string) => request<void>('DELETE', `/chats/${id}`),
  leaveChat: (id: string) => request<void>('POST', `/chats/${id}/leave`),
  addParticipant: (id: string, userId: string) =>
    request<{ participants: string[] }>('POST', `/chats/${id}/participants`, { userId }),
  removeParticipant: (id: string, userId: string) =>
    request<{ participants: string[] }>('DELETE', `/chats/${id}/participants/${userId}`),
  addAdmin: (id: string, userId: string) => request<{ admins: string[] }>('POST', `/chats/${id}/admins`, { userId }),
  removeAdmin: (id: string, userId: string) => request<{ admins: string[] }>('DELETE', `/chats/${id}/admins/${userId}`),

  messages: (chatId: string, before?: string, limit = 50) =>
    request<Message[]>('GET', `/messages/chat/${chatId}?limit=${limit}${before ? `&before=${before}` : ''}`),
  sendMessage: (input: SendMessageInput) => request<Message>('POST', '/messages', input),
  updateMessage: (id: string, content: string) => request<Message>('PUT', `/messages/${id}`, { content }),
  deleteMessage: (id: string) => request<void>('DELETE', `/messages/${id}`),

  uploadImage: (file: File) => request<UploadedFile>('POST', '/upload/image', fileForm(file)),
};
