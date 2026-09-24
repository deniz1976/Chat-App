export type UserStatus = 'online' | 'offline' | 'away';

export interface User {
  id: string;
  username: string;
  displayName: string;
  profileImage: string | null;
  status: UserStatus;
  lastSeen: string;
}

export interface Profile extends User {
  email: string;
  role: 'user' | 'admin';
  createdAt: string;
}

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'file';

export interface MessageSender {
  id: string;
  username: string;
  displayName: string;
  profileImage: string | null;
}

export interface ReplySummary {
  id: string;
  senderId: string;
  content: string;
  type: MessageType;
  mediaUrl: string | null;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  type: MessageType;
  mediaUrl: string | null;
  replyToId: string | null;
  readBy: string[];
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sender?: MessageSender;
  replyTo?: ReplySummary | null;
}

export interface LastMessage {
  id: string;
  senderId: string;
  content: string;
  type: MessageType;
  mediaUrl: string | null;
  createdAt: string;
}

export interface Chat {
  id: string;
  name: string | null;
  type: 'direct' | 'group';
  avatar: string | null;
  createdBy: string;
  participants: string[];
  admins: string[];
  members: User[];
  lastMessage: LastMessage | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface UploadedFile {
  url: string;
  filename: string;
  mimetype: string;
  size: number;
}
