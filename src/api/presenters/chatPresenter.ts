import { ChatView } from '../../core/services/ChatService';
import { toPublicUser } from './userPresenter';

export const toChatResponse = ({ chat, members, unreadCount }: ChatView) => ({
  id: chat.id,
  name: chat.name,
  type: chat.type,
  avatar: chat.avatar,
  createdBy: chat.createdBy,
  participants: chat.participants,
  admins: chat.admins,
  members: members.map(toPublicUser),
  lastMessage: chat.lastMessage
    ? {
        id: chat.lastMessage.id,
        senderId: chat.lastMessage.senderId,
        content: chat.lastMessage.content,
        type: chat.lastMessage.type,
        mediaUrl: chat.lastMessage.mediaUrl,
        createdAt: chat.lastMessage.createdAt,
      }
    : null,
  unreadCount,
  createdAt: chat.createdAt,
  updatedAt: chat.updatedAt,
});
