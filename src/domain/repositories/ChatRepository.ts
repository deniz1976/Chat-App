import { Chat, ChatCreationAttributes } from '../entities/Chat';

export interface ChatRepository {
  findById(id: string): Promise<Chat | null>;
  findByParticipants(participantIds: string[]): Promise<Chat[]>;
  findDirectChat(userIds: [string, string]): Promise<Chat | null>;
  findUserChats(userId: string): Promise<Chat[]>;
  create(chatData: ChatCreationAttributes): Promise<Chat>;
  update(id: string, chatData: Partial<ChatCreationAttributes>): Promise<Chat | null>;
  delete(id: string): Promise<boolean>;
  addParticipant(chatId: string, userId: string): Promise<Chat | null>;
  removeParticipant(chatId: string, userId: string): Promise<Chat | null>;
  addAdmin(chatId: string, userId: string): Promise<Chat | null>;
  removeAdmin(chatId: string, userId: string): Promise<Chat | null>;
  updateLastMessage(chatId: string, messageId: string): Promise<Chat | null>;
} 